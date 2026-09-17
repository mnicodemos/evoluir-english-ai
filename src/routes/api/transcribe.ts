import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

const MAX_AUDIO_BYTES = 14 * 1024 * 1024;
const GEMINI_TRANSCRIPTION_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash"] as const;

/**
 * Transcription only needs to echo what was said, so we turn off the model's
 * "thinking" step and cap the answer. This is the main source of the delay
 * students feel when their sentence or word is being checked.
 */
const FAST_CONFIG = {
  temperature: 0,
  maxOutputTokens: 256,
  thinkingConfig: { thinkingBudget: 0 },
};

type GeminiTranscription = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
        if (!token) return Response.json({ message: "Please sign in to use voice conversation." }, { status: 401 });

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];
        if (!supabaseUrl || !publishableKey || !lovableKey || !connectionKey) {
          return Response.json({ message: "Voice conversation is not configured yet." }, { status: 500 });
        }

        const auth = getAuthClient(supabaseUrl, publishableKey);
        // Read the audio and validate the session at the same time instead of
        // waiting for one and then the other.
        const [claimsResult, form] = await Promise.all([
          auth.auth.getClaims(token),
          request.formData().catch(() => null),
        ]);
        const { data, error } = claimsResult;
        if (error || !data?.claims?.sub) {
          return Response.json({ message: "Please sign in again to use voice conversation." }, { status: 401 });
        }

        const audio = form?.get("file");
        if (!(audio instanceof File) || audio.size < 2048) {
          return Response.json({ message: "That recording was empty. Please try again." }, { status: 400 });
        }
        if (audio.size > MAX_AUDIO_BYTES) {
          return Response.json({ message: "That recording is too long. Please record a shorter answer." }, { status: 413 });
        }
        if (audio.type !== "audio/wav") {
          return Response.json({ message: "This audio format is not supported." }, { status: 415 });
        }

        const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
        let result: GeminiTranscription | null = null;
        let failureStatus = 503;

        for (const model of GEMINI_TRANSCRIPTION_MODELS) {
          const response = await fetch(
            `https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableKey}`,
                "X-Connection-Api-Key": connectionKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [
                    { text: "Transcribe this English speech exactly. Return only the transcript, with no commentary or quotation marks." },
                    { inlineData: { mimeType: "audio/wav", data: audioBase64 } },
                  ],
                }],
              }),
            },
          );

          if (response.ok) {
            result = (await response.json()) as GeminiTranscription;
            break;
          }

          failureStatus = response.status;
          const errorBody = await response.text().catch(() => "");
          console.error(`Gemini transcription failed [${response.status}] on ${model}: ${errorBody.slice(0, 300)}`);

          // Only a quota limit can be model-specific. Other failures should not
          // trigger another paid request with the same audio.
          if (response.status !== 429) break;
        }

        if (!result) {
          const message = failureStatus === 429
            ? "Your Google AI voice limit is busy right now. Please wait about a minute and try again."
            : "I couldn't process that recording right now. Please try again in a moment.";
          return Response.json({ message }, { status: failureStatus });
        }

        const transcript = (result.candidates?.[0]?.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!transcript) {
          return Response.json({ message: "I couldn't hear that clearly. Please try again." }, { status: 422 });
        }

        const streamEvent = `data: ${JSON.stringify({ type: "transcript.text.done", text: transcript })}\n\n`;
        return new Response(streamEvent, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
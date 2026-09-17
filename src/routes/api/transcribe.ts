import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiRequest } from "@/lib/api-auth.server";
import { AiUsageError, finishAiUsage, hashAiRequest, reserveAiUsage } from "@/lib/ai-usage.server";

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
        let userId: string;
        try {
          userId = await authenticateApiRequest(request);
        } catch (error) {
          return Response.json({ message: error instanceof Response && error.status === 401 ? "Please sign in again to use voice conversation." : "Voice conversation is not configured yet." }, { status: error instanceof Response ? error.status : 500 });
        }
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];
        if (!lovableKey || !connectionKey) {
          return Response.json({ message: "Voice conversation is not configured yet." }, { status: 500 });
        }

        const form = await request.formData().catch(() => null);

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
        let ticket;
        try {
          ticket = await reserveAiUsage({ userId, operation: "transcription", model: GEMINI_TRANSCRIPTION_MODELS[0], requestHash: await hashAiRequest({ size: audio.size, sample: audioBase64.slice(0, 1024) }) });
        } catch (error) {
          const headers = new Headers();
          if (error instanceof AiUsageError && error.retryAfter) headers.set("Retry-After", String(error.retryAfter));
          return Response.json({ message: error instanceof Error ? error.message : "Voice transcription is temporarily unavailable." }, { status: error instanceof AiUsageError ? error.status : 503, headers });
        }
        let result: GeminiTranscription | null = null;
        let failureStatus = 503;

        const requestBody = (fast: boolean) =>
          JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "Transcribe this English speech exactly. Return only the transcript, with no commentary or quotation marks." },
                { inlineData: { mimeType: "audio/wav", data: audioBase64 } },
              ],
            }],
            generationConfig: fast ? FAST_CONFIG : { temperature: 0, maxOutputTokens: 256 },
          });

        const send = (model: string, fast: boolean) =>
          fetch(
            `https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableKey}`,
                "X-Connection-Api-Key": connectionKey,
                "Content-Type": "application/json",
              },
              body: requestBody(fast),
            },
          );

        for (const model of GEMINI_TRANSCRIPTION_MODELS) {
          let response = await send(model, true);
          // Older model versions reject the "no thinking" setting: retry plainly.
          if (response.status === 400) response = await send(model, false);

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
          await finishAiUsage(ticket, { success: false, errorCode: `gemini_${failureStatus}`, errorMessage: message });
          return Response.json({ message }, { status: failureStatus });
        }

        const transcript = (result.candidates?.[0]?.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!transcript) {
          await finishAiUsage(ticket, { success: false, errorCode: "empty_transcript", errorMessage: "No speech was recognized." });
          return Response.json({ message: "I couldn't hear that clearly. Please try again." }, { status: 422 });
        }

        await finishAiUsage(ticket, { success: true });

        const streamEvent = `data: ${JSON.stringify({ type: "transcript.text.done", text: transcript })}\n\n`;
        return new Response(streamEvent, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
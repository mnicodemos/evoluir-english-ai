import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  voice: z
    .enum(["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"])
    .default("alloy"),
});

// The Lovable audio gateway needs workspace credits; this project has its own
// Google Gemini key connected, so speech is generated there instead.
const GEMINI_TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"] as const;

// Map the app's voice picker onto Gemini's prebuilt voices.
const GEMINI_VOICES: Record<string, string> = {
  alloy: "Kore",
  ash: "Charon",
  coral: "Aoede",
  echo: "Fenrir",
  fable: "Puck",
  nova: "Leda",
  onyx: "Orus",
  sage: "Callirrhoe",
  shimmer: "Zephyr",
};


export const Route = createFileRoute("/api/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ")
          ? authorization.slice(7)
          : null;
        if (!token) {
          return Response.json({ message: "Please sign in to use audio." }, { status: 401 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!supabaseUrl || !publishableKey || !apiKey) {
          return Response.json(
            { message: "Audio is not configured yet." },
            { status: 500 },
          );
        }

        const auth = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const [claimsResult, bodyResult] = await Promise.all([
          auth.auth.getClaims(token),
          request.json().catch(() => null),
        ]);
        const { data, error } = claimsResult;
        if (error || !data?.claims?.sub) {
          return Response.json({ message: "Please sign in again to use audio." }, { status: 401 });
        }

        const parsed = requestSchema.safeParse(bodyResult);
        if (!parsed.success) {
          return Response.json({ message: "Choose a valid word to hear." }, { status: 400 });
        }

        const geminiKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];
        if (!geminiKey) {
          return Response.json({ message: "Audio is not configured yet." }, { status: 500 });
        }

        const voiceName = GEMINI_VOICES[parsed.data.voice] ?? "Kore";
        const body = JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Say clearly and naturally in English for a Brazilian learner: ${parsed.data.text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          },
        });

        let lastStatus = 502;
        let lastMessage = "Audio generation failed.";

        let upstream: Response | null = null;
        for (const model of GEMINI_TTS_MODELS) {
          const res = await fetch(
            `https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key/v1beta/models/${model}:streamGenerateContent?alt=sse`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "X-Connection-Api-Key": geminiKey,
                "Content-Type": "application/json",
              },
              body,
            },
          );

          if (res.ok && res.body) {
            upstream = res;
            break;
          }

          lastStatus = res.status;
          const raw = await res.text().catch(() => "");
          try {
            const parsedBody = JSON.parse(raw) as { error?: { message?: string } };
            lastMessage = parsedBody.error?.message ?? lastMessage;
          } catch {
            if (raw) lastMessage = raw.slice(0, 200);
          }
          if (res.status !== 429 && res.status < 500) break;
        }

        if (!upstream?.body) {
          return Response.json(
            {
              message:
                lastStatus === 429
                  ? "Your Google audio limit is busy. Please try again in a moment."
                  : lastMessage,
            },
            { status: lastStatus },
          );
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let pending = "";
        let sentAudio = false;
        const stream = upstream.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              pending += decoder.decode(chunk, { stream: true });
              const events = pending.split(/\r?\n\r?\n/);
              pending = events.pop() ?? "";
              for (const event of events) {
                for (const line of event.split(/\r?\n/)) {
                  if (!line.startsWith("data:")) continue;
                  try {
                    const payload = JSON.parse(line.slice(5).trim()) as {
                      candidates?: Array<{
                        content?: { parts?: Array<{ inlineData?: { data?: string } }> };
                      }>;
                    };
                    for (const candidate of payload.candidates ?? []) {
                      for (const part of candidate.content?.parts ?? []) {
                        const audio = part.inlineData?.data;
                        if (!audio) continue;
                        sentAudio = true;
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({ type: "speech.audio.delta", audio })}\n\n`,
                          ),
                        );
                      }
                    }
                  } catch {
                    // Ignore provider keep-alives and metadata-only events.
                  }
                }
              }
            },
            flush(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify(
                    sentAudio
                      ? { type: "speech.audio.done" }
                      : { type: "speech.audio.error", message: "The audio service returned no sound." },
                  )}\n\n`,
                ),
              );
            },
          }),
        );

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
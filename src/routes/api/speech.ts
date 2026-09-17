import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  voice: z
    .enum(["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"])
    .default("alloy"),
});

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

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
        const { data, error } = await auth.auth.getClaims(token);
        if (error || !data?.claims?.sub) {
          return Response.json({ message: "Please sign in again to use audio." }, { status: 401 });
        }

        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ message: "Choose a valid word to hear." }, { status: 400 });
        }

        const geminiKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];


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

        let audioBase64 = "";
        let lastStatus = 502;
        let lastMessage = "Audio generation failed.";

        // Primary: the managed audio service, which streams natural speech and
        // is not limited by the Google free-tier daily quota.
        try {
          const managed = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-tts-preview",
              contents: [{ role: "user", parts: [{ text: parsed.data.text }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
              },
              stream_format: "sse",
            }),
          });
          if (managed.ok && managed.body) {
            return new Response(managed.body, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
            });
          }
          lastStatus = managed.status;
          lastMessage = "Audio generation failed.";
        } catch {
          // Fall through to the project's own Google key below.
        }

        outer: for (const model of geminiKey ? GEMINI_TTS_MODELS : []) {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const res = await fetch(
              `https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key/v1beta/models/${model}:generateContent`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "X-Connection-Api-Key": geminiKey ?? "",
                  "Content-Type": "application/json",
                },
                body,
              },
            );

            if (res.ok) {
              const json = (await res.json()) as {
                candidates?: Array<{
                  content?: { parts?: Array<{ inlineData?: { data?: string } }> };
                }>;
              };
              const data = (json.candidates?.[0]?.content?.parts ?? [])
                .map((p) => p.inlineData?.data ?? "")
                .join("");
              if (data) {
                audioBase64 = data;
                break outer;
              }
              lastStatus = 502;
              lastMessage = "The audio service returned no sound.";
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
            if (res.status !== 429 && res.status < 500) break outer;
            if (attempt === 0) await wait(600 + Math.random() * 300);
          }
        }

        if (!audioBase64) {
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

        // The client reads an SSE stream of PCM deltas, so wrap the audio in the
        // same event shape the audio gateway used.
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            const chunkSize = 32_000;
            for (let i = 0; i < audioBase64.length; i += chunkSize) {
              const payload = JSON.stringify({
                type: "speech.audio.delta",
                audio: audioBase64.slice(i, i + chunkSize),
              });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "speech.audio.done" })}\n\n`),
            );
            controller.close();
          },
        });

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
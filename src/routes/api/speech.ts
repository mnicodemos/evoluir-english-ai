import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/api-auth.server";
import { AiUsageError, finishAiUsage, hashAiRequest, reserveAiUsage } from "@/lib/ai-usage.server";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  cacheable: z.boolean().default(false),
});

// The Lovable audio gateway needs workspace credits; this project has its own
// Google Gemini key connected, so speech is generated there instead.
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

const GEMINI_VOICE = "Kore";

export const Route = createFileRoute("/api/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let userId: string;
        try {
          userId = await authenticateApiRequest(request);
        } catch (error) {
          return Response.json(
            {
              message:
                error instanceof Response && error.status === 401
                  ? "Please sign in again to use audio."
                  : "Audio is not configured yet.",
            },
            { status: error instanceof Response ? error.status : 500 },
          );
        }
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ message: "Audio is not configured yet." }, { status: 500 });
        }

        const bodyResult = await request.json().catch(() => null);

        const parsed = requestSchema.safeParse(bodyResult);
        if (!parsed.success) {
          return Response.json({ message: "Choose a valid word to hear." }, { status: 400 });
        }

        const geminiKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];
        if (!geminiKey) {
          return Response.json({ message: "Audio is not configured yet." }, { status: 500 });
        }

        let ticket;
        try {
          ticket = await reserveAiUsage({
            userId,
            operation: "tts",
            model: GEMINI_TTS_MODEL,
            requestHash: await hashAiRequest(parsed.data.text),
          });
        } catch (error) {
          const headers = new Headers();
          if (error instanceof AiUsageError && error.retryAfter)
            headers.set("Retry-After", String(error.retryAfter));
          return Response.json(
            {
              message: error instanceof Error ? error.message : "Audio is temporarily unavailable.",
            },
            { status: error instanceof AiUsageError ? error.status : 503, headers },
          );
        }

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
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
          },
        });

        const upstream = await fetch(
          `https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key/v1beta/models/${GEMINI_TTS_MODEL}:streamGenerateContent?alt=sse`,
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

        if (!upstream.ok || !upstream.body) {
          const raw = await upstream.text().catch(() => "");
          let message = "Audio generation failed.";
          try {
            const parsedBody = JSON.parse(raw) as { error?: { message?: string } };
            message = parsedBody.error?.message ?? message;
          } catch {
            if (raw) message = raw.slice(0, 200);
          }
          const responseHeaders = new Headers();
          if (upstream.status === 429) {
            responseHeaders.set("Retry-After", upstream.headers.get("Retry-After") ?? "60");
          }
          await finishAiUsage(ticket, {
            success: false,
            errorCode: `gemini_${upstream.status}`,
            errorMessage: message,
          });
          return Response.json(
            {
              message:
                upstream.status === 429
                  ? "Your Google audio limit is busy. Please try again in a moment."
                  : message,
            },
            {
              status: upstream.status,
              headers: responseHeaders,
            },
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
            async flush(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify(
                    sentAudio
                      ? { type: "speech.audio.done" }
                      : {
                          type: "speech.audio.error",
                          message: "The audio service returned no sound.",
                        },
                  )}\n\n`,
                ),
              );
              await finishAiUsage(ticket, {
                success: sentAudio,
                ...(sentAudio
                  ? {}
                  : {
                      errorCode: "empty_audio",
                      errorMessage: "The audio service returned no sound.",
                    }),
              });
            },
          }),
        );

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": parsed.data.cacheable
              ? "public, max-age=31536000, immutable"
              : "no-store",
            Vary: "Authorization",
          },
        });
      },
    },
  },
});

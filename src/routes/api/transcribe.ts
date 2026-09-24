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

// One spaced retry is enough for a brief provider interruption. More attempts
// kept the Listening Lab on "Checking..." for 40+ seconds without improving
// the recording itself.
const MAX_TRANSCRIPTION_ATTEMPTS = 2;
const TRANSCRIPTION_ATTEMPT_TIMEOUT_MS = 15_000;

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 5000);
  return Math.min(750 * 2 ** attempt + Math.random() * 250, 3000);
}

async function waitForRetry(milliseconds: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("The transcription was cancelled.", "AbortError"));
      },
      { once: true },
    );
  });
}

async function sendWithDeadline(
  url: string,
  init: Omit<RequestInit, "signal">,
  requestSignal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_ATTEMPT_TIMEOUT_MS);
  requestSignal.addEventListener("abort", abortFromRequest, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (requestSignal.aborted) throw error;
    if (controller.signal.aborted) {
      return Response.json({ message: "Transcription attempt timed out." }, { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", abortFromRequest);
  }
}

export const Route = createFileRoute("/api/transcribe")({
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
                  ? "Please sign in again to use voice conversation."
                  : "Voice conversation is not configured yet.",
            },
            { status: error instanceof Response ? error.status : 500 },
          );
        }
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];
        if (!lovableKey || !connectionKey) {
          return Response.json(
            { message: "Voice conversation is not configured yet." },
            { status: 500 },
          );
        }

        const form = await request.formData().catch(() => null);

        const audio = form?.get("file");
        if (!(audio instanceof File) || audio.size < 2048) {
          return Response.json(
            { message: "That recording was empty. Please try again." },
            { status: 400 },
          );
        }
        if (audio.size > MAX_AUDIO_BYTES) {
          return Response.json(
            { message: "That recording is too long. Please record a shorter answer." },
            { status: 413 },
          );
        }
        if (audio.type !== "audio/wav") {
          return Response.json({ message: "This audio format is not supported." }, { status: 415 });
        }

        const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
        let ticket;
        try {
          ticket = await reserveAiUsage({
            userId,
            operation: "transcription",
            model: GEMINI_TRANSCRIPTION_MODELS[0],
            requestHash: await hashAiRequest({
              size: audio.size,
              sample: audioBase64.slice(0, 1024),
            }),
          });
        } catch (error) {
          const headers = new Headers();
          if (error instanceof AiUsageError && error.retryAfter)
            headers.set("Retry-After", String(error.retryAfter));
          return Response.json(
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Voice transcription is temporarily unavailable.",
            },
            { status: error instanceof AiUsageError ? error.status : 503, headers },
          );
        }
        // From here on the usage record is open: every exit path must close it,
        // otherwise the "one request at a time" guard stays locked.
        let settled = false;
        const settle = async (result: {
          success: boolean;
          errorCode?: string;
          errorMessage?: string;
        }) => {
          if (settled) return;
          settled = true;
          await finishAiUsage(ticket, result);
        };

        try {
          let result: GeminiTranscription | null = null;
          let failureStatus = 503;

          const requestBody = (fast: boolean) =>
            JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: "Transcribe this English speech exactly. Return only the transcript, with no commentary or quotation marks.",
                    },
                    { inlineData: { mimeType: "audio/wav", data: audioBase64 } },
                  ],
                },
              ],
              generationConfig: fast ? FAST_CONFIG : { temperature: 0, maxOutputTokens: 256 },
            });

          const send = (model: string, fast: boolean) =>
            sendWithDeadline(
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
              request.signal,
            );

          for (const model of GEMINI_TRANSCRIPTION_MODELS) {
            for (let attempt = 0; attempt < MAX_TRANSCRIPTION_ATTEMPTS; attempt += 1) {
              let response = await send(model, true);
              // A 400 here can mean this model version does not accept thinkingConfig.
              // Repair that request once by removing only the unsupported setting.
              if (response.status === 400) response = await send(model, false);

              if (response.ok) {
                result = (await response.json()) as GeminiTranscription;
                break;
              }

              failureStatus = response.status;
              const errorBody = await response.text().catch(() => "");
              console.error(
                `Gemini transcription failed [${response.status}] on ${model} (attempt ${attempt + 1}/${MAX_TRANSCRIPTION_ATTEMPTS}): ${errorBody.slice(0, 300)}`,
              );

              const retryable = response.status === 429 || response.status >= 500;
              if (!retryable || attempt === MAX_TRANSCRIPTION_ATTEMPTS - 1) break;
              await waitForRetry(retryDelay(response, attempt), request.signal);
            }

            if (result) break;
            // Preserve the existing quota-only fallback. Transient 5xx failures
            // are retried on the requested model and do not switch models.
            if (failureStatus !== 429) break;
          }

          if (!result) {
            const message =
              failureStatus === 429
                ? "Your Google AI voice limit is busy right now. Please wait about a minute and try again."
                : failureStatus >= 500
                  ? "Voice processing is temporarily busy. Please wait a moment and try again."
                  : "I couldn't process that recording right now. Please try again in a moment.";
            await settle({
              success: false,
              errorCode: `gemini_${failureStatus}`,
              errorMessage: message,
            });
            return Response.json({ message }, { status: failureStatus });
          }

          const transcript = (result.candidates?.[0]?.content?.parts ?? [])
            .map((part) => part.text ?? "")
            .join("")
            .trim();
          if (!transcript) {
            await settle({
              success: false,
              errorCode: "empty_transcript",
              errorMessage: "No speech was recognized.",
            });
            return Response.json(
              { message: "I couldn't hear that clearly. Please try again." },
              { status: 422 },
            );
          }

          await settle({ success: true });

          const streamEvent = `data: ${JSON.stringify({ type: "transcript.text.done", text: transcript })}\n\n`;
          return new Response(streamEvent, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        } catch (error) {
          const aborted = error instanceof Error && error.name === "AbortError";
          await settle({
            success: false,
            errorCode: aborted ? "cancelled" : "transcription_failed",
            errorMessage: error instanceof Error ? error.message : "Transcription failed",
          });
          if (aborted) return new Response(null, { status: 499 });
          return Response.json(
            { message: "I couldn't process that recording right now. Please try again." },
            { status: 503 },
          );
        } finally {
          // Safety net: a path that returned without settling still closes here.
          await settle({
            success: false,
            errorCode: "incomplete",
            errorMessage: "Request ended without a result",
          });
        }
      },
    },
  },
});

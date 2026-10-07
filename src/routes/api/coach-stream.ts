import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/api-auth.server";
import {
  AiUsageError,
  finishAiUsage,
  hashAiRequest,
  loadAiLimit,
  releaseAbandonedAiUsage,
  reserveAiUsage,
} from "@/lib/ai-usage.server";
import { GEMINI_TEXT_MODEL, openGeminiStream, parseGeminiStreamEvent } from "@/lib/gemini.server";

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(60),
});

export const Route = createFileRoute("/api/coach-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Checking the session and reading the body do not depend on each
        // other, so they run together: less waiting before EVO starts.
        const [auth, body] = await Promise.all([
          authenticateApiRequest(request).then(
            (id) => ({ id, error: null }),
            (error: unknown) => ({ id: null, error }),
          ),
          request.json().catch(() => null),
        ]);
        if (auth.id === null) {
          const error = auth.error;
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
        const userId = auth.id;

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success)
          return Response.json(
            { message: "The conversation request is invalid." },
            { status: 400 },
          );

        let ticket;
        try {
          // The limits row, the request hash and the closing of abandoned
          // records are independent reads; only the reservation needs them all.
          const [limit, requestHash] = await Promise.all([
            loadAiLimit("talking"),
            hashAiRequest(parsed.data),
            releaseAbandonedAiUsage(userId, "talking"),
          ]);
          ticket = await reserveAiUsage({
            userId,
            operation: "talking",
            model: GEMINI_TEXT_MODEL,
            requestHash,
            limit,
            abandonedReleased: true,
          });
        } catch (error) {
          const status = error instanceof AiUsageError ? error.status : 503;
          const headers = new Headers();
          if (error instanceof AiUsageError && error.retryAfter)
            headers.set("Retry-After", String(error.retryAfter));
          return Response.json(
            {
              message:
                error instanceof Error ? error.message : "AI Speaking is temporarily unavailable.",
            },
            { status, headers },
          );
        }

        const FIRST_CHUNK_MS = 20_000;
        const BETWEEN_CHUNKS_MS = 15_000;
        const TIMEOUT_MESSAGE =
          "Voice processing is taking longer than expected. Please try again.";
        const upstreamAbort = new AbortController();
        let timedOut = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const arm = (ms: number) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            timedOut = true;
            upstreamAbort.abort();
          }, ms);
        };
        let settled = false;
        let firstChunkAt = 0;
        // Token usage reported by the final "response.completed" event (observability only).
        let usage: { inputTokens?: number; outputTokens?: number } | undefined;
        // Closes the usage record exactly once so the one-request-at-a-time
        // guard is released immediately, never waiting for the 90 s sweep.
        const settle = async (success: boolean, errorCode?: string, errorMessage?: string) => {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          await finishAiUsage(ticket, {
            success,
            ...(usage ?? {}),
            ...(firstChunkAt ? { firstChunkAt } : {}),
            ...(errorCode ? { errorCode, errorMessage: errorMessage ?? errorCode } : {}),
          });
        };
        const onClientAbort = () => {
          upstreamAbort.abort();
          void settle(false, "cancelled", "The student left or cancelled the reply");
        };
        request.signal.addEventListener("abort", onClientAbort, { once: true });

        arm(FIRST_CHUNK_MS);
        let upstream: Response | null;
        try {
          // AI Speaking runs on the workspace's own Gemini key (owner request,
          // 2026-10-04), with the thinking step off so the first words come fast.
          upstream = await openGeminiStream(parsed.data.messages, upstreamAbort.signal, {
            fast: true,
            maxOutputTokens: 600,
          });
        } catch (error) {
          await settle(
            false,
            timedOut ? "timeout" : "gemini_network",
            error instanceof Error ? error.message : "Network failure",
          );
          return Response.json(
            { message: timedOut ? TIMEOUT_MESSAGE : "AI Speaking could not answer right now." },
            { status: timedOut ? 504 : 503 },
          );
        }
        if (!upstream) {
          await settle(false, "not_configured", "Gemini connection missing");
          return Response.json(
            { message: "AI Speaking is temporarily unavailable." },
            { status: 500 },
          );
        }
        if (!upstream.ok || !upstream.body) {
          const raw = await upstream.text().catch(() => "");
          console.error(`Gemini talking failed [${upstream.status}]: ${raw.slice(0, 300)}`);
          const message =
            upstream.status === 429
              ? "Your Google Gemini limit is temporarily busy. Please try again in a moment."
              : "AI Speaking could not answer right now. Please try again.";
          const headers = new Headers();
          if (upstream.status === 429)
            headers.set("Retry-After", upstream.headers.get("Retry-After") ?? "60");
          await settle(false, `gemini_${upstream.status}`, raw.slice(0, 240) || message);
          return Response.json({ message }, { status: upstream.status, headers });
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const reader = upstream.body.getReader();
        let pending = "";
        let emittedText = false;
        const send = (controller: ReadableStreamDefaultController<Uint8Array>, data: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        const consume = (
          controller: ReadableStreamDefaultController<Uint8Array>,
          event: string,
        ) => {
          const parsedEvent = parseGeminiStreamEvent(event);
          if (parsedEvent.usage) usage = parsedEvent.usage;
          if (parsedEvent.delta) {
            // Time to the first word: what the student actually waits for.
            if (!emittedText) firstChunkAt = Date.now();
            emittedText = true;
            send(controller, { type: "coach.text.delta", delta: parsedEvent.delta });
          }
          if (parsedEvent.error)
            send(controller, {
              type: "coach.text.error",
              message: "AI Speaking could not finish the reply.",
            });
        };

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                // Every upstream chunk restarts the 15 s gap limit.
                arm(BETWEEN_CHUNKS_MS);
                pending += decoder.decode(value, { stream: true });
                const events = pending.split(/\r?\n\r?\n/);
                pending = events.pop() ?? "";
                for (const event of events) consume(controller, event);
              }
              if (pending.trim()) consume(controller, pending);
              send(
                controller,
                emittedText
                  ? { type: "coach.text.done" }
                  : { type: "coach.text.error", message: "AI Speaking returned an empty reply." },
              );
              await settle(
                emittedText,
                emittedText ? undefined : "empty_response",
                emittedText ? undefined : "AI Speaking returned an empty reply.",
              );
              controller.close();
            } catch (error) {
              if (request.signal.aborted) {
                await settle(false, "cancelled", "The student left or cancelled the reply");
                return;
              }
              await settle(
                false,
                timedOut ? "timeout" : "stream_interrupted",
                error instanceof Error ? error.message : "Stream interrupted",
              );
              try {
                send(controller, {
                  type: "coach.text.error",
                  message: timedOut ? TIMEOUT_MESSAGE : "AI Speaking could not finish the reply.",
                });
                controller.close();
              } catch {
                // The client already disconnected.
              }
            } finally {
              request.signal.removeEventListener("abort", onClientAbort);
            }
          },
          async cancel() {
            upstreamAbort.abort();
            await settle(false, "cancelled", "The student left or cancelled the reply");
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      },
    },
  },
});

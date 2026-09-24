import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/api-auth.server";
import { AiUsageError, finishAiUsage, hashAiRequest, reserveAiUsage } from "@/lib/ai-usage.server";
import {
  LOVABLE_TALKING_MODEL,
  openLovableTalkingStream,
  parseLovableEvent,
} from "@/lib/lovable-chat.server";

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
        const body = await request.json().catch(() => null);

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success)
          return Response.json(
            { message: "The conversation request is invalid." },
            { status: 400 },
          );

        let ticket;
        try {
          ticket = await reserveAiUsage({
            userId,
            operation: "talking",
            model: LOVABLE_TALKING_MODEL,
            requestHash: await hashAiRequest(parsed.data),
          });
        } catch (error) {
          const status = error instanceof AiUsageError ? error.status : 503;
          const headers = new Headers();
          if (error instanceof AiUsageError && error.retryAfter)
            headers.set("Retry-After", String(error.retryAfter));
          return Response.json(
            {
              message:
                error instanceof Error ? error.message : "AI Talking is temporarily unavailable.",
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
        // Closes the usage record exactly once so the one-request-at-a-time
        // guard is released immediately, never waiting for the 90 s sweep.
        const settle = async (success: boolean, errorCode?: string, errorMessage?: string) => {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          await finishAiUsage(ticket, {
            success,
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
          upstream = await openLovableTalkingStream(parsed.data.messages, upstreamAbort.signal);
        } catch (error) {
          await settle(
            false,
            timedOut ? "timeout" : "lovable_network",
            error instanceof Error ? error.message : "Network failure",
          );
          return Response.json(
            { message: timedOut ? TIMEOUT_MESSAGE : "AI Talking could not answer right now." },
            { status: timedOut ? 504 : 503 },
          );
        }
        if (!upstream) {
          await settle(false, "not_configured", "LOVABLE_API_KEY missing");
          return Response.json(
            { message: "AI Talking is temporarily unavailable." },
            { status: 500 },
          );
        }
        if (!upstream.ok || !upstream.body) {
          const raw = await upstream.text().catch(() => "");
          console.error(`Lovable AI talking failed [${upstream.status}]: ${raw.slice(0, 300)}`);
          const message =
            upstream.status === 402
              ? "AI credits are exhausted. Please try again later."
              : "AI Talking could not answer right now. Please try again.";
          const headers = new Headers();
          if (upstream.status === 429)
            headers.set("Retry-After", upstream.headers.get("Retry-After") ?? "60");
          await settle(false, `lovable_${upstream.status}`, raw.slice(0, 240) || message);
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
          const parsedEvent = parseLovableEvent(event);
          if (parsedEvent.delta) {
            emittedText = true;
            send(controller, { type: "coach.text.delta", delta: parsedEvent.delta });
          }
          if (parsedEvent.error)
            send(controller, {
              type: "coach.text.error",
              message: "AI Talking could not finish the reply.",
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
                  : { type: "coach.text.error", message: "AI Talking returned an empty reply." },
              );
              await settle(
                emittedText,
                emittedText ? undefined : "empty_response",
                emittedText ? undefined : "AI Talking returned an empty reply.",
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
                  message: timedOut ? TIMEOUT_MESSAGE : "AI Talking could not finish the reply.",
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

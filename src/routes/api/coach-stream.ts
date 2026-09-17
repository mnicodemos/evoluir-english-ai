import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/api-auth.server";
import { AiUsageError, finishAiUsage, hashAiRequest, reserveAiUsage } from "@/lib/ai-usage.server";
import { GEMINI_TEXT_MODEL, openGeminiStream } from "@/lib/gemini.server";

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

type GeminiEvent = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

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
            model: GEMINI_TEXT_MODEL,
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

        let upstream: Response | null;
        try {
          upstream = await openGeminiStream(parsed.data.messages);
        } catch (error) {
          await finishAiUsage(ticket, {
            success: false,
            errorCode: "gemini_network",
            errorMessage: error instanceof Error ? error.message : "Network failure",
          });
          return Response.json(
            { message: "Google Gemini could not answer right now." },
            { status: 503 },
          );
        }
        if (!upstream) {
          await finishAiUsage(ticket, {
            success: false,
            errorCode: "not_configured",
            errorMessage: "Google Gemini is not connected yet.",
          });
          return Response.json({ message: "Google Gemini is not connected yet." }, { status: 500 });
        }
        if (!upstream.ok || !upstream.body) {
          const raw = await upstream.text().catch(() => "");
          let message = "Google Gemini could not answer right now.";
          try {
            const payload = JSON.parse(raw) as { error?: { message?: string } };
            message = payload.error?.message ?? message;
          } catch {
            if (raw) message = raw.slice(0, 240);
          }
          const headers = new Headers();
          if (upstream.status === 429)
            headers.set("Retry-After", upstream.headers.get("Retry-After") ?? "60");
          await finishAiUsage(ticket, {
            success: false,
            errorCode: `gemini_${upstream.status}`,
            errorMessage: message,
          });
          return Response.json({ message }, { status: upstream.status, headers });
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let pending = "";
        let emittedText = false;
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
                    const payload = JSON.parse(line.slice(5).trim()) as GeminiEvent;
                    const delta = (payload.candidates?.[0]?.content?.parts ?? [])
                      .map((part) => part.text ?? "")
                      .join("");
                    if (delta) {
                      emittedText = true;
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ type: "coach.text.delta", delta })}\n\n`,
                        ),
                      );
                    }
                    if (payload.error?.message) {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ type: "coach.text.error", message: payload.error.message })}\n\n`,
                        ),
                      );
                    }
                  } catch {
                    // Ignore provider keep-alives.
                  }
                }
              }
            },
            async flush(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify(
                    emittedText
                      ? { type: "coach.text.done" }
                      : {
                          type: "coach.text.error",
                          message: "Google Gemini returned an empty reply.",
                        },
                  )}\n\n`,
                ),
              );
              await finishAiUsage(ticket, {
                success: emittedText,
                ...(emittedText
                  ? {}
                  : {
                      errorCode: "empty_response",
                      errorMessage: "Google Gemini returned an empty reply.",
                    }),
              });
            },
          }),
        );

        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      },
    },
  },
});

import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { openGeminiStream } from "@/lib/gemini.server";

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

let authClient: ReturnType<typeof createClient> | null = null;

function getAuthClient(url: string, key: string) {
  authClient ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authClient;
}

export const Route = createFileRoute("/api/coach-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
        if (!token)
          return Response.json(
            { message: "Please sign in to use voice conversation." },
            { status: 401 },
          );

        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key)
          return Response.json(
            { message: "Voice conversation is not configured yet." },
            { status: 500 },
          );

        const [claimsResult, body] = await Promise.all([
          getAuthClient(url, key).auth.getClaims(token),
          request.json().catch(() => null),
        ]);
        if (claimsResult.error || !claimsResult.data?.claims?.sub) {
          return Response.json(
            { message: "Please sign in again to use voice conversation." },
            { status: 401 },
          );
        }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success)
          return Response.json(
            { message: "The conversation request is invalid." },
            { status: 400 },
          );

        const upstream = await openGeminiStream(parsed.data.messages);
        if (!upstream)
          return Response.json({ message: "Google Gemini is not connected yet." }, { status: 500 });
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
            flush(controller) {
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

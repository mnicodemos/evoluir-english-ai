import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { callGateway } from "./ai-gateway.server";

/**
 * Authenticated Gemini entry point for short conversational and writing tasks.
 */
export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["system", "user", "assistant"]),
              content: z.string().min(1).max(8000),
            }),
          )
          .min(1)
          .max(60),
        jsonMode: z.boolean().default(false),
        operation: z.enum(["chat", "talking", "writing_correction"]).default("chat"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // AI Talking must never wait indefinitely: the upstream call is really
    // aborted after 20 s so the usage slot is released at once.
    const signal = data.operation === "talking" ? AbortSignal.timeout(20_000) : undefined;
    const text = await callGateway(
      data.messages,
      data.jsonMode,
      { userId: context.userId, operation: data.operation },
      signal,
    );
    return text.trim();
  });

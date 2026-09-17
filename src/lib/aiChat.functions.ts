import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { callGateway } from "./ai-gateway.server";

/**
 * Generic cloud fallback used by the hybrid AI layer (src/lib/local-ai.ts)
 * when the browser's built-in model is not available.
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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const text = await callGateway(data.messages, data.jsonMode);
    return text.trim();
  });

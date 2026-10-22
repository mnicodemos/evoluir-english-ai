import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway } from "@/lib/ai-gateway.server";
import { WRITING_HELP_KINDS, writingHelpMessages } from "@/lib/writingHelp";

const inputSchema = z
  .object({
    kind: z.enum(WRITING_HELP_KINDS as [string, ...string[]]),
    task: z.string().trim().min(1).max(500),
    draft: z.string().max(4000).default(""),
    question: z.string().trim().max(500).default(""),
    lang: z.enum(["pt", "en"]),
  })
  .strict();

/**
 * EVO's help on the Writing screen (writingHelp.ts). It runs as an AI Teacher
 * call (operation "teacher"), so it shares the AI Teacher's daily limit; the
 * level comes from the student's profile, never from the client.
 */
export const askWritingHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.kind === "ask" && !data.question) throw new Error("Write your question first.");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("level")
      .eq("id", context.userId)
      .maybeSingle();
    const reply = await callGateway(
      writingHelpMessages({
        kind: data.kind as (typeof WRITING_HELP_KINDS)[number],
        task: data.task,
        level: (profile?.level ?? "A2").toUpperCase(),
        draft: data.draft,
        question: data.question,
        lang: data.lang as "pt" | "en",
      }),
      false,
      { userId: context.userId, operation: "teacher", fast: true, maxOutputTokens: 400 },
    );
    return { reply: reply.trim() };
  });

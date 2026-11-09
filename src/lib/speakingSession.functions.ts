import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
}).strict();

const saveSchema = z.object({
  operationKey: z.string().uuid(),
  scenario: z.enum(["everyday", "professional", "travel"]),
  messages: z.array(messageSchema).min(1).max(60),
}).strict();

/** Restore the student's most recent unfinished AI Speaking conversation. */
export const getSpeakingCheckpoint = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminClient();
    const { data, error } = await admin
      .from("ai_conversations")
      .select("id, scenario, messages, updated_at")
      .eq("user_id", context.userId)
      .eq("topic", "ai-speaking:active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("AI Speaking session could not be restored");
    if (!data) return null;
    const messages = z.array(messageSchema).safeParse(data.messages);
    if (!messages.success || messages.data.length === 0) return null;
    const scenario = z.enum(["everyday", "professional", "travel"]).safeParse(data.scenario);
    if (!scenario.success) return null;
    return { operationKey: data.id, scenario: scenario.data, messages: messages.data };
  });

/** Persist the full conversation after each completed turn, not only at finish. */
export const saveSpeakingCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { error } = await admin.from("ai_conversations").upsert(
      {
        id: data.operationKey,
        user_id: context.userId,
        scenario: data.scenario,
        topic: "ai-speaking:active",
        messages: data.messages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error("AI Speaking session could not be saved");
    // Keep exactly one resumable AI Speaking session for this student.
    const { error: cleanupError } = await admin
      .from("ai_conversations")
      .delete()
      .eq("user_id", context.userId)
      .eq("topic", "ai-speaking:active")
      .neq("id", data.operationKey);
    if (cleanupError) throw new Error("Older AI Speaking checkpoint could not be cleaned up");
    return { saved: true };
  });

/** Remove only the resumable checkpoint after the report has been saved. */
export const clearSpeakingCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operationKey: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { error } = await admin
      .from("ai_conversations")
      .delete()
      .eq("id", data.operationKey)
      .eq("user_id", context.userId)
      .eq("topic", "ai-speaking:active");
    if (error) throw new Error("Completed AI Speaking checkpoint could not be cleared");
    return { cleared: true };
  });

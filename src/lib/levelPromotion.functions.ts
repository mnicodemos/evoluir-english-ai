import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { checkPromotion } from "./levelPromotion";

/**
 * Moves the student up one CEFR level after a passed Final Test. The browser
 * can no longer write level/max_level upward (migration 0036); this server
 * check against the stored quiz result is the only way up.
 */
export const promoteAfterFinalTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptKey: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: result }] = await Promise.all([
      admin.from("profiles").select("level").eq("id", context.userId).maybeSingle(),
      admin
        .from("quiz_results")
        .select("user_id, score, lesson_id")
        .eq("id", data.attemptKey)
        .maybeSingle(),
    ]);
    if (!profile) throw new Error("Profile not found");
    const { data: lesson } = result?.lesson_id
      ? await admin
          .from("lessons")
          .select("curriculum_key")
          .eq("id", result.lesson_id)
          .maybeSingle()
      : { data: null };

    const check = checkPromotion({
      userId: context.userId,
      profileLevel: profile.level,
      result: result ? { user_id: result.user_id, score: result.score } : null,
      lessonKey: lesson?.curriculum_key ?? null,
    });
    if (!check.ok) return { promoted: false as const, reason: check.reason };

    const { error } = await admin
      .from("profiles")
      .update({ level: check.next, max_level: check.next })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { promoted: true as const, level: check.next };
  });

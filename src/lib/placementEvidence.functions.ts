import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findLevel, LEVELS } from "@/lib/level";
import { PLACEMENT_RUBRIC_VERSION, placementEvidence } from "@/lib/pedagogy/activityEvidence";
import { measuredCefr } from "@/lib/pedagogy/cefr";
import { toleratePedagogicalFailure } from "@/lib/pedagogy/dualWrite";
import { persistActivityEvidence } from "@/lib/pedagogy/dualWriteCore";
import { isAnswered, isCorrectAnswer, PLACEMENT_QUESTIONS } from "@/lib/placementTest";

/**
 * The placement test's answers become the first Listening and Grammar
 * evidence (audit item 12, 2026-10-17), graded here on the server against the
 * same questions. Once per student; a failure never blocks onboarding.
 */
export const recordPlacementEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ answers: z.record(z.string().max(40), z.string().max(200)) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("level")
      .eq("id", context.userId)
      .maybeSingle();
    const placed = LEVELS.findIndex((level) => level.value === findLevel(profile?.level).value);
    const answers = PLACEMENT_QUESTIONS.flatMap((question) => {
      const band = measuredCefr(question.band.toUpperCase());
      const given = data.answers[question.id];
      const bandIndex = LEVELS.findIndex((level) => level.value === question.band);
      if (!band || bandIndex > placed || !isAnswered(given)) return [];
      // "I don't know" is an honest wrong answer at that band.
      return [
        {
          questionId: question.id,
          kind: question.kind,
          band,
          correct: isCorrectAnswer(question, given),
        },
      ];
    });
    const result = await toleratePedagogicalFailure(() =>
      persistActivityEvidence({
        userId: context.userId,
        sourceType: "placement",
        operationKey: "placement-test",
        rubricVersion: PLACEMENT_RUBRIC_VERSION,
        evidence: placementEvidence(answers),
      }),
    );
    return { evidenceCount: result?.evidenceCount ?? 0 };
  });

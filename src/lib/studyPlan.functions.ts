// Server function for My Study Plan; the work lives in studyPlan.server.ts so the
// daily push can build the same plan.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { StudyPlanResult } from "./studyPlan.server";

export type { StudyPlanResult } from "./studyPlan.server";

export const loadStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudyPlanResult> => {
    const { loadStudyPlanFor } = await import("./studyPlan.server");
    return loadStudyPlanFor(context.userId);
  });

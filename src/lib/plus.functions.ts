import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  fallbackPlusStep,
  guessPlusArea,
  parsePlusSteps,
  plusStepsPrompt,
  PLUS_AREAS,
  PLUS_MAX_GOALS,
  PLUS_SCORE_DAYS,
  type PlusArea,
  type PlusGoal,
  type PlusLang,
  type PlusStep,
} from "./plus";
import { studyToday } from "./today";

type GoalRow = { id: string; title: string; area: string; created_at: string };
type StepRow = { id: string; goal_id: string; day: string; text: string; done_at: string | null };

// plus_goals / plus_goal_steps (migration 0051) are not in the generated
// Supabase types until Lovable regenerates them.
type LooseTable = {
  select: (columns: string) => LooseQuery;
  insert: (row: object) => LooseQuery;
  upsert: (rows: object[], options: object) => LooseQuery;
  update: (row: object) => LooseQuery;
  delete: () => LooseQuery;
};
type LooseQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  is: (column: string, value: null) => LooseQuery;
  gte: (column: string, value: string) => LooseQuery;
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
};

async function tables() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const from = (name: string) => (supabaseAdmin.from as unknown as (n: string) => LooseTable)(name);
  return {
    admin: supabaseAdmin,
    goals: () => from("plus_goals"),
    steps: () => from("plus_goal_steps"),
  };
}

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function toGoal(row: GoalRow): PlusGoal {
  return {
    id: row.id,
    title: row.title,
    area: (PLUS_AREAS as readonly string[]).includes(row.area) ? (row.area as PlusArea) : "other",
  };
}

function toStep(row: StepRow): PlusStep {
  return { id: row.id, goalId: row.goal_id, day: row.day, text: row.text, doneAt: row.done_at };
}

const langSchema = z.enum(["pt", "en"]);

export type PlusOverview = {
  today: string;
  goals: PlusGoal[];
  todaySteps: PlusStep[];
  /** Steps given and done in the last PLUS_SCORE_DAYS days, today included. */
  stepsGiven: number;
  stepsDone: number;
};

/**
 * The Plus page: active goals and today's step for each. A goal without a step
 * today gets one now, written by EVO, or a ready-made one when the AI is slow
 * or unavailable, so a goal is never left without its step.
 */
export const loadPlus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lang: langSchema }).parse(input))
  .handler(async ({ data, context }): Promise<PlusOverview> => {
    const { admin, goals, steps } = await tables();
    const today = studyToday();
    const since = addDays(today, -(PLUS_SCORE_DAYS - 1));

    const { data: goalRows, error } = await goals()
      .select("id, title, area, created_at")
      .eq("user_id", context.userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Goals could not be loaded");
    const active = ((goalRows ?? []) as GoalRow[]).map(toGoal);

    const readSteps = async () => {
      const { data: rows, error: stepsError } = await steps()
        .select("id, goal_id, day, text, done_at")
        .eq("user_id", context.userId)
        .gte("day", addDays(since, -7))
        .order("day", { ascending: false });
      if (stepsError) throw new Error("Steps could not be loaded");
      return ((rows ?? []) as StepRow[]).map(toStep);
    };
    let history = await readSteps();

    const missing = active.filter(
      (goal) => !history.some((step) => step.goalId === goal.id && step.day === today),
    );
    if (missing.length) {
      const lang = data.lang as PlusLang;
      let written = new Map<string, string>();
      try {
        const [{ callGateway }, { data: profile }] = await Promise.all([
          import("./ai-gateway.server"),
          admin.from("profiles").select("level").eq("id", context.userId).maybeSingle(),
        ]);
        const raw = await callGateway(
          plusStepsPrompt({
            lang,
            englishLevel: profile?.level ?? "b1",
            goals: missing.map((goal) => ({
              ...goal,
              recent: history.filter((step) => step.goalId === goal.id).map((step) => step.text),
            })),
          }),
          true,
          {
            userId: context.userId,
            operation: "chat",
            cacheKey: `plus-steps:${context.userId}:${today}:${missing.map((goal) => goal.id).join(",")}`,
            fast: true,
            maxOutputTokens: 600,
          },
          AbortSignal.timeout(15_000),
        );
        written = parsePlusSteps(
          raw,
          missing.map((goal) => goal.id),
        );
      } catch (aiError) {
        console.warn("Plus steps fell back to ready-made ones", aiError);
      }
      const { error: insertError } = await steps().upsert(
        missing.map((goal) => ({
          goal_id: goal.id,
          user_id: context.userId,
          day: today,
          text: written.get(goal.id) ?? fallbackPlusStep(goal.area, today, lang),
        })),
        // Two tabs opening at once keep the first step written.
        { onConflict: "goal_id,day", ignoreDuplicates: true },
      );
      if (insertError) throw new Error("Steps could not be saved");
      history = await readSteps();
    }

    const activeIds = new Set(active.map((goal) => goal.id));
    const window = history.filter((step) => step.day >= since);
    return {
      today,
      goals: active,
      todaySteps: history.filter((step) => step.day === today && activeIds.has(step.goalId)),
      stepsGiven: window.length,
      stepsDone: window.filter((step) => step.doneAt !== null).length,
    };
  });

export const addPlusGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ title: z.string().trim().min(3).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { goals } = await tables();
    const { data: rows } = await goals()
      .select("id")
      .eq("user_id", context.userId)
      .is("archived_at", null);
    if (((rows ?? []) as unknown[]).length >= PLUS_MAX_GOALS) {
      throw new Error("You can have up to 3 goals at a time.");
    }
    const { error } = await goals().insert({
      user_id: context.userId,
      title: data.title,
      area: guessPlusArea(data.title),
    });
    if (error) {
      throw new Error(
        error.message.includes("plus_goal_limit")
          ? "You can have up to 3 goals at a time."
          : "The goal could not be saved.",
      );
    }
    return { ok: true };
  });

export const archivePlusGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { goals, steps } = await tables();
    const { error } = await goals()
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The goal could not be removed.");
    // Today's unfinished step goes with it, so it cannot hold the day back.
    await steps().delete().eq("goal_id", data.id).eq("day", studyToday()).is("done_at", null);
    return { ok: true };
  });

export const setPlusStepDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { steps } = await tables();
    // Only today's step can be ticked: the streak is about doing it today.
    const { data: rows, error } = await steps()
      .update({ done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("day", studyToday())
      .select("id");
    if (error || !((rows ?? []) as unknown[]).length)
      throw new Error("The step could not be saved.");
    return { ok: true };
  });

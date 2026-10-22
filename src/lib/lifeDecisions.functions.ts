import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  cleanDecisionAnalysis,
  cleanRatings,
  DECISION_MAX_ACTIVE,
  decisionAnalysisPrompt,
  decisionGoalTitle,
  decisionInputSchema,
  decisionCriterionSchema,
  decisionOptionSchema,
  type DecisionStatus,
  type LifeDecision,
} from "./lifeDecisions";
import { guessPlusArea, PLUS_MAX_GOALS } from "./plus";
import { hasPremium } from "./premium.server";

// life_decisions (migration 0080) is not in the generated Supabase types until
// Lovable regenerates them, like the Life+ AI tables in life.functions.ts.
type LooseQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  is: (column: string, value: null) => LooseQuery;
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  maybeSingle: () => LooseQuery;
  single: () => LooseQuery;
};
type LooseTable = {
  select: (columns: string) => LooseQuery;
  insert: (row: object) => LooseQuery;
  update: (row: object) => LooseQuery;
  delete: () => LooseQuery;
};

async function table(name: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin.from as unknown as (n: string) => LooseTable)(name);
}

async function requirePremium(userId: string) {
  if (!(await hasPremium(userId))) throw new Error("Decisions are part of Premium.");
}

const COLUMNS =
  "id, title, context, options, criteria, ratings, status, chosen_option_id, analysis, created_at, updated_at";

type DecisionRow = {
  id: string;
  title: string;
  context: string | null;
  options: unknown;
  criteria: unknown;
  ratings: unknown;
  status: string;
  chosen_option_id: string | null;
  analysis: string | null;
  created_at: string;
  updated_at: string;
};

/** A stored row as the screen reads it; malformed items are left out, never thrown. */
function toDecision(row: DecisionRow): LifeDecision {
  const options = z.array(decisionOptionSchema).safeParse(row.options);
  const criteria = z.array(decisionCriterionSchema).safeParse(row.criteria);
  const ratings = z.record(z.string(), z.number()).safeParse(row.ratings);
  const status: DecisionStatus = row.status === "decided" ? "decided" : "active";
  return {
    id: row.id,
    title: row.title,
    context: row.context ?? "",
    options: options.success ? options.data : [],
    criteria: criteria.success ? criteria.data : [],
    ratings: ratings.success ? ratings.data : {},
    status,
    chosenOptionId: row.chosen_option_id,
    analysis: row.analysis,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ownDecision(id: string, userId: string) {
  const { data, error } = await (
    await table("life_decisions")
  )
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("This decision was not found.");
  return toDecision(data as DecisionRow);
}

export type LifeDecisionsData = {
  premium: boolean;
  /** False until migration 0080 is applied: the page says it is coming soon. */
  available: boolean;
  decisions: LifeDecision[];
};

/** The student's decisions, newest first. Free students see the Premium invitation. */
export const loadLifeDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LifeDecisionsData> => {
    const premium = await hasPremium(context.userId);
    const { data, error } = await (
      await table("life_decisions")
    )
      .select(COLUMNS)
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) return { premium, available: false, decisions: [] };
    return {
      premium,
      available: true,
      decisions: ((data ?? []) as DecisionRow[]).map(toDecision),
    };
  });

/**
 * Creates or edits a decision. Editing clears EVO's analysis, which described
 * the old matrix, and keeps the choice only while its option still exists.
 */
export const saveLifeDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid().optional(), decision: decisionInputSchema })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const decision = data.decision;
    const row = {
      title: decision.title,
      context: decision.context,
      options: decision.options,
      criteria: decision.criteria,
      ratings: cleanRatings(decision),
      analysis: null,
      updated_at: new Date().toISOString(),
    };
    const decisions = await table("life_decisions");
    if (data.id) {
      const current = await ownDecision(data.id, context.userId);
      const chosenKept = decision.options.some((option) => option.id === current.chosenOptionId);
      const { error } = await decisions
        .update({
          ...row,
          ...(chosenKept ? {} : { chosen_option_id: null, status: "active" }),
        })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error("The decision could not be saved.");
      return { id: data.id };
    }
    const { data: existing } = await (
      await table("life_decisions")
    )
      .select("id")
      .eq("user_id", context.userId);
    if (((existing ?? []) as unknown[]).length >= DECISION_MAX_ACTIVE) {
      throw new Error("You can keep up to 20 decisions. Delete an old one to add another.");
    }
    const { data: created, error } = await decisions
      .insert({ ...row, user_id: context.userId })
      .select("id")
      .single();
    if (error || !created) throw new Error("The decision could not be saved.");
    return { id: (created as { id: string }).id };
  });

export const deleteLifeDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const { error } = await (
      await table("life_decisions")
    )
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The decision could not be deleted.");
    return { ok: true };
  });

/**
 * Marks the option the student chose (or reopens the decision with null).
 * With `goal`, the chosen option also becomes a Life+ AI goal when there is a
 * free slot (up to 3 goals); "full" tells the screen there was none.
 */
export const chooseLifeDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        optionId: z.string().max(16).nullable(),
        goal: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ goal: "created" | "full" | "skipped" }> => {
    await requirePremium(context.userId);
    const decision = await ownDecision(data.id, context.userId);
    const option = data.optionId
      ? decision.options.find((item) => item.id === data.optionId)
      : null;
    if (data.optionId && !option) throw new Error("This option was not found.");
    const { error } = await (
      await table("life_decisions")
    )
      .update({
        status: option ? "decided" : "active",
        chosen_option_id: option?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The decision could not be saved.");
    if (!option || !data.goal) return { goal: "skipped" };

    const goals = await table("plus_goals");
    const { data: active } = await goals
      .select("id")
      .eq("user_id", context.userId)
      .is("archived_at", null);
    if (((active ?? []) as unknown[]).length >= PLUS_MAX_GOALS) return { goal: "full" };
    const title = decisionGoalTitle(option.name);
    const { error: goalError } = await (
      await table("plus_goals")
    ).insert({
      user_id: context.userId,
      title,
      area: guessPlusArea(`${title} ${decision.title}`),
      description: decision.title.slice(0, 500),
    });
    if (goalError) {
      if (goalError.message.includes("plus_goal_limit")) return { goal: "full" };
      throw new Error("The goal could not be saved.");
    }
    return { goal: "created" };
  });

/** EVO's analysis of the matrix, in the student's language; stored with the decision. */
export const analyzeLifeDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), lang: z.enum(["pt", "en"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const decision = await ownDecision(data.id, context.userId);
    if (decision.options.length < 2 || decision.criteria.length < 1) {
      throw new Error("Add at least two options and one criterion first.");
    }
    const { callGateway } = await import("./ai-gateway.server");
    const raw = await callGateway(decisionAnalysisPrompt({ lang: data.lang, decision }), false, {
      userId: context.userId,
      operation: "chat",
      fast: true,
      maxOutputTokens: 1200,
    });
    const analysis = cleanDecisionAnalysis(raw);
    if (!analysis) throw new Error("EVO could not analyse this decision. Please try again.");
    const { error } = await (
      await table("life_decisions")
    )
      .update({ analysis })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) console.error(`Decision analysis could not be stored: ${error.message}`);
    return { analysis };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  addDays,
  LIFE_HABIT_FREQUENCIES,
  LIFE_HABIT_HISTORY_DAYS,
  LIFE_MAX_HABITS,
  LIFE_MAX_MILESTONES,
  LIFE_PRIORITIES,
  lifeCoachContext,
  lifeCoachPrompt,
  parseLifeCoach,
  type LifeCoachReply,
  type LifeHabit,
  type LifeHabitFrequency,
  type LifeHabitLog,
  type LifeMilestone,
  type LifePriority,
  type LifePriorityLevel,
  type LifeTask,
  withStudyDayLogs,
} from "./life";
import { hasPremium } from "./premium.server";
import { studyToday } from "./today";

// The Life+ AI tables (migration 0068) are not in the generated Supabase types
// until Lovable regenerates them, like plus_goals in plus.functions.ts.
type LooseQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  is: (column: string, value: null) => LooseQuery;
  in: (column: string, values: unknown[]) => LooseQuery;
  gte: (column: string, value: string) => LooseQuery;
  lte: (column: string, value: string) => LooseQuery;
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  maybeSingle: () => LooseQuery;
};
type LooseTable = {
  select: (columns: string) => LooseQuery;
  insert: (row: object) => LooseQuery;
  upsert: (rows: object | object[], options: object) => LooseQuery;
  update: (row: object) => LooseQuery;
  delete: () => LooseQuery;
};

async function table(name: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin.from as unknown as (n: string) => LooseTable)(name);
}

/** The save error; linking needs migration 0071 (life_habits.linked). */
function linkError(linked: boolean | undefined) {
  return linked
    ? "Linking to study days is not available yet. Please try again later."
    : "The habit could not be saved.";
}

/** A student's habits; before migration 0071 adds `linked`, read without it. */
async function readHabits(userId: string) {
  const habitsTable = await table("life_habits");
  const withLink = await habitsTable
    .select("id, title, frequency, times_per_week, category, linked")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (!withLink.error) return withLink;
  const legacyTable = await table("life_habits");
  return legacyTable
    .select("id, title, frequency, times_per_week, category")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
}

async function requirePremium(userId: string) {
  if (!(await hasPremium(userId)))
    throw new Error("Life+ AI routine, habits and coach are Premium.");
}

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type LifeGoal = {
  id: string;
  title: string;
  area: string;
  deadline: string | null;
  description: string | null;
};

export type LifeOverview = {
  today: string;
  premium: boolean;
  goals: LifeGoal[];
  milestones: LifeMilestone[];
  tasks: LifeTask[];
  habits: LifeHabit[];
  logs: LifeHabitLog[];
  priority: LifePriority | null;
};

type TaskRow = {
  id: string;
  title: string;
  day: string;
  priority: string;
  goal_id: string | null;
  done_at: string | null;
};
type HabitRow = {
  id: string;
  title: string;
  frequency: string;
  times_per_week: number | null;
  category: string | null;
  linked?: string | null;
};
type MilestoneRow = {
  id: string;
  goal_id: string;
  title: string;
  position: number;
  done_at: string | null;
};

const toTask = (row: TaskRow): LifeTask => ({
  id: row.id,
  title: row.title,
  day: row.day,
  priority: (LIFE_PRIORITIES as readonly string[]).includes(row.priority)
    ? (row.priority as LifePriorityLevel)
    : "medium",
  goalId: row.goal_id,
  doneAt: row.done_at,
});
const toHabit = (row: HabitRow): LifeHabit => ({
  id: row.id,
  title: row.title,
  frequency: (LIFE_HABIT_FREQUENCIES as readonly string[]).includes(row.frequency)
    ? (row.frequency as LifeHabitFrequency)
    : "daily",
  timesPerWeek: row.times_per_week,
  category: row.category,
  linked: row.linked === "study_day" ? "study_day" : null,
});
const toMilestone = (row: MilestoneRow): LifeMilestone => ({
  id: row.id,
  goalId: row.goal_id,
  title: row.title,
  position: row.position,
  doneAt: row.done_at,
});

async function readOverview(userId: string): Promise<LifeOverview> {
  const today = studyToday();
  const premium = await hasPremium(userId);
  const goalsTable = await table("plus_goals");
  // Before migration 0068 the new columns are missing: read the old ones.
  let goalRead = await goalsTable
    .select("id, title, area, deadline, description")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (goalRead.error) {
    goalRead = await goalsTable
      .select("id, title, area")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
  }
  const goals = ((goalRead.data ?? []) as Partial<LifeGoal>[]).map((goal) => ({
    id: goal.id!,
    title: goal.title!,
    area: goal.area ?? "other",
    deadline: goal.deadline ?? null,
    description: goal.description ?? null,
  }));

  const goalIds = goals.map((goal) => goal.id);
  const milestoneRead = goalIds.length
    ? await (
        await table("plus_goal_milestones")
      )
        .select("id, goal_id, title, position, done_at")
        .in("goal_id", goalIds)
        .order("position", { ascending: true })
    : { data: [], error: null };
  const milestones = milestoneRead.error
    ? []
    : ((milestoneRead.data ?? []) as MilestoneRow[]).map(toMilestone);

  if (!premium) {
    return { today, premium, goals, milestones, tasks: [], habits: [], logs: [], priority: null };
  }

  const [taskRead, habitRead, logRead, priorityRead, studyDayRead] = await Promise.all([
    (await table("life_tasks"))
      .select("id, title, day, priority, goal_id, done_at")
      .eq("user_id", userId)
      .gte("day", addDays(today, -7))
      .lte("day", addDays(today, 30))
      .order("created_at", { ascending: true }),
    readHabits(userId),
    (await table("life_habit_logs"))
      .select("habit_id, day")
      .eq("user_id", userId)
      .gte("day", addDays(today, -LIFE_HABIT_HISTORY_DAYS)),
    (await table("life_priorities"))
      .select("text, day, done_at")
      .eq("user_id", userId)
      .maybeSingle(),
    // Linked habits take their check-ins from the study days (migration 0071).
    (await table("study_days"))
      .select("day")
      .eq("user_id", userId)
      .gte("day", addDays(today, -LIFE_HABIT_HISTORY_DAYS)),
  ]);
  const habits = ((habitRead.data ?? []) as HabitRow[]).map(toHabit);
  const studyDays = studyDayRead.error
    ? []
    : ((studyDayRead.data ?? []) as { day: string }[]).map((row) => row.day);
  const priorityRow = priorityRead.data as {
    text: string;
    day: string;
    done_at: string | null;
  } | null;
  return {
    today,
    premium,
    goals,
    milestones,
    tasks: ((taskRead.data ?? []) as TaskRow[]).map(toTask),
    habits,
    logs: withStudyDayLogs(
      habits,
      ((logRead.data ?? []) as { habit_id: string; day: string }[]).map((row) => ({
        habitId: row.habit_id,
        day: row.day,
      })),
      studyDays,
    ),
    priority: priorityRow
      ? { text: priorityRow.text, day: priorityRow.day, doneAt: priorityRow.done_at }
      : null,
  };
}

/** Everything the Life+ AI screens show, in one read. */
export const loadLife = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readOverview(context.userId));

// ------------------------------------------------------------------ Routine

export const saveLifeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(160),
        day,
        priority: z.enum(["high", "medium", "low"]),
        goalId: uuid.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const { error } = await (
      await table("life_tasks")
    ).insert({
      user_id: context.userId,
      title: data.title,
      day: data.day,
      priority: data.priority,
      goal_id: data.goalId ?? null,
    });
    if (error) throw new Error("The task could not be saved.");
    return { ok: true };
  });

/** Edits a task's text, day, priority and goal (user request: edit tasks). */
export const updateLifeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: uuid,
        title: z.string().trim().min(1).max(160),
        day,
        priority: z.enum(["high", "medium", "low"]),
        goalId: uuid.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const { error } = await (
      await table("life_tasks")
    )
      .update({
        title: data.title,
        day: data.day,
        priority: data.priority,
        goal_id: data.goalId ?? null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The task could not be saved.");
    return { ok: true };
  });

export const setLifeTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid, done: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const { error } = await (
      await table("life_tasks")
    )
      .update({ done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The task could not be saved.");
    return { ok: true };
  });

export const deleteLifeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const { error } = await (
      await table("life_tasks")
    )
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The task could not be removed.");
    return { ok: true };
  });

// ------------------------------------------------------------------- Habits

export const addLifeHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        frequency: z.enum(["daily", "weekdays", "times_per_week"]),
        timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
        category: z.string().trim().max(40).nullable().optional(),
        linkedToStudyDay: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const habits = await table("life_habits");
    const { data: rows } = await habits
      .select("id")
      .eq("user_id", context.userId)
      .is("archived_at", null);
    if (((rows ?? []) as unknown[]).length >= LIFE_MAX_HABITS) {
      throw new Error("You can keep up to 12 habits.");
    }
    const { error } = await habits.insert({
      user_id: context.userId,
      title: data.title,
      frequency: data.frequency,
      times_per_week: data.frequency === "times_per_week" ? (data.timesPerWeek ?? 3) : null,
      category: data.category || null,
      // Sent only when chosen, so habits still save before migration 0071.
      ...(data.linkedToStudyDay ? { linked: "study_day" } : {}),
    });
    if (error) throw new Error(linkError(data.linkedToStudyDay));
    return { ok: true };
  });

/** Edits a habit's text, frequency and category; its check-ins stay (user request). */
export const updateLifeHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: uuid,
        title: z.string().trim().min(1).max(120),
        frequency: z.enum(["daily", "weekdays", "times_per_week"]),
        timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
        category: z.string().trim().max(40).nullable().optional(),
        linkedToStudyDay: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const { error } = await (
      await table("life_habits")
    )
      .update({
        title: data.title,
        frequency: data.frequency,
        times_per_week: data.frequency === "times_per_week" ? (data.timesPerWeek ?? 3) : null,
        category: data.category || null,
        ...(data.linkedToStudyDay === undefined
          ? {}
          : { linked: data.linkedToStudyDay ? "study_day" : null }),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("archived_at", null);
    if (error) throw new Error(linkError(data.linkedToStudyDay));
    return { ok: true };
  });

export const archiveLifeHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const { error } = await (
      await table("life_habits")
    )
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The habit could not be removed.");
    return { ok: true };
  });

/** One check-in for a habit on today or one of the 6 days before. */
export const setLifeHabitDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ habitId: uuid, day, done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const today = studyToday();
    if (data.day > today || data.day < addDays(today, -6)) {
      throw new Error("Only this week's days can be marked.");
    }
    const { data: habit } = await (
      await table("life_habits")
    )
      .select("id")
      .eq("id", data.habitId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!habit) throw new Error("Habit not found.");
    // A habit linked to the study day is ticked only by studying (0071).
    const habitsTable = await table("life_habits");
    const link = await habitsTable
      .select("linked")
      .eq("id", data.habitId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!link.error && (link.data as { linked?: string | null } | null)?.linked === "study_day") {
      throw new Error("This habit is ticked by your English study days.");
    }
    const logs = await table("life_habit_logs");
    const { error } = data.done
      ? await logs.upsert(
          { habit_id: data.habitId, user_id: context.userId, day: data.day },
          { onConflict: "habit_id,day", ignoreDuplicates: true },
        )
      : await logs.delete().eq("habit_id", data.habitId).eq("day", data.day);
    if (error) throw new Error("The habit could not be saved.");
    return { ok: true };
  });

// ------------------------------------------------------- Priority of the day

export const setLifePriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().trim().min(1).max(200).optional(),
        done: z.boolean().optional(),
        // Removes today's priority altogether (user request: let me delete it).
        clear: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePremium(context.userId);
    const priorities = await table("life_priorities");
    const today = studyToday();
    const { error } = data.clear
      ? await priorities.delete().eq("user_id", context.userId)
      : data.text !== undefined
        ? await priorities.upsert(
            {
              user_id: context.userId,
              text: data.text,
              day: today,
              done_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )
        : await priorities
            .update({ done_at: data.done ? new Date().toISOString() : null })
            .eq("user_id", context.userId)
            .eq("day", today);
    if (error) throw new Error("The priority could not be saved.");
    return { ok: true };
  });

// --------------------------------------------- Goal deadline and milestones

async function ownGoal(goalId: string, userId: string) {
  const { data } = await (
    await table("plus_goals")
  )
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (!data) throw new Error("Goal not found.");
}

export const updateGoalDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: uuid,
        deadline: day.nullable(),
        description: z.string().trim().max(400).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (
      await table("plus_goals")
    )
      .update({ deadline: data.deadline, description: data.description || null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The goal could not be saved.");
    return { ok: true };
  });

export const addGoalMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ goalId: uuid, title: z.string().trim().min(1).max(160) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ownGoal(data.goalId, context.userId);
    const milestones = await table("plus_goal_milestones");
    const { data: rows } = await milestones.select("position").eq("goal_id", data.goalId);
    const list = (rows ?? []) as { position: number }[];
    if (list.length >= LIFE_MAX_MILESTONES) throw new Error("A goal keeps up to 12 milestones.");
    const { error } = await milestones.insert({
      goal_id: data.goalId,
      user_id: context.userId,
      title: data.title,
      position: list.reduce((max, row) => Math.max(max, row.position), -1) + 1,
    });
    if (error) throw new Error("The milestone could not be saved.");
    return { ok: true };
  });

export const setGoalMilestoneDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid, done: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (
      await table("plus_goal_milestones")
    )
      .update({ done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The milestone could not be saved.");
    return { ok: true };
  });

export const deleteGoalMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (
      await table("plus_goal_milestones")
    )
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("The milestone could not be removed.");
    return { ok: true };
  });

// --------------------------------------------------------------- Life Coach

export const askLifeCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lang: z.enum(["pt", "en"]),
        message: z.string().trim().min(1).max(1000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) }))
          .max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<LifeCoachReply> => {
    await requirePremium(context.userId);
    const overview = await readOverview(context.userId);
    const goalIds = overview.goals.map((goal) => goal.id);
    const { callGateway } = await import("./ai-gateway.server");
    const raw = await callGateway(
      lifeCoachPrompt({
        lang: data.lang,
        context: lifeCoachContext(overview),
        history: data.history,
        message: data.message,
        goalIds,
      }),
      true,
      { userId: context.userId, operation: "chat", fast: true, maxOutputTokens: 1200 },
    );
    const reply = parseLifeCoach(raw, goalIds);
    if (!reply) throw new Error("EVO could not answer this message. Please send it again.");
    return reply;
  });

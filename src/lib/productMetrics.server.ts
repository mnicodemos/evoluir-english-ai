// Product numbers the owner watches (retention, first conversation, AI
// Speaking wait). Shared by the Admin tabs and the Admin alerts, so both
// always show the same figures. Callers pass the service-role client.

import type { supabaseAdmin as SupabaseAdminClient } from "@/integrations/supabase/client.server";
import { landingFunnel, type LandingStatRow } from "@/lib/landingStats";
import { goalsReport } from "@/lib/plus";
import { addDays, firstConversationStats, retentionReport } from "@/lib/retention";
import { speakingWaitSummary } from "@/lib/speakingTiming";
import { studyToday } from "@/lib/today";

type SupabaseAdmin = typeof SupabaseAdminClient;

/**
 * Retention: how many students come back the day and the week after signing
 * up. Active days come from what students did (activities, finished lessons,
 * answered AI calls), in São Paulo dates. Admins are left out.
 */
export async function loadRetention(supabaseAdmin: SupabaseAdmin) {
  const today = studyToday();
  // 8 weekly cohorts plus the 2 weeks they need to be measured.
  const since = new Date(`${addDays(today, -7 * 8 - 15)}T00:00:00-03:00`).toISOString();
  const PAGE = 1000;
  const MAX_ROWS = 50_000;

  // PostgREST returns at most 1000 rows per request, so read in pages.
  async function readAll<T>(
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ) {
    const rows: T[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await page(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  }

  const [profiles, admins, activities, lessons, aiCalls] = await Promise.all([
    readAll((from, to) =>
      supabaseAdmin.from("profiles").select("id, created_at").order("id").range(from, to),
    ),
    supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    readAll((from, to) =>
      supabaseAdmin
        .from("activities")
        .select("user_id, created_at")
        .gte("created_at", since)
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabaseAdmin
        .from("user_lessons")
        .select("user_id, completed_at")
        .gte("completed_at", since)
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabaseAdmin
        .from("ai_usage_events")
        .select("user_id, created_at")
        .eq("status", "completed")
        .gte("created_at", since)
        .order("id")
        .range(from, to),
    ),
  ]);

  const adminIds = new Set((admins.data ?? []).map((row) => row.user_id));
  const activeDays = new Map<string, Set<string>>();
  const mark = (userId: string | null, at: string | null) => {
    if (!userId || !at) return;
    const days = activeDays.get(userId) ?? new Set<string>();
    days.add(studyToday(new Date(at)));
    activeDays.set(userId, days);
  };
  activities.forEach((row) => mark(row.user_id, row.created_at));
  lessons.forEach((row) => mark(row.user_id, row.completed_at));
  aiCalls.forEach((row) => mark(row.user_id, row.created_at));

  const students = profiles
    .filter((row) => !adminIds.has(row.id))
    .map((row) => ({ id: row.id, joined: studyToday(new Date(row.created_at)) }));
  // First spoken answer to EVO: an AI Speaking reply (the opener has no
  // first_chunk_ms). Older databases without the column just show no data.
  const replies = await readAll((from, to) =>
    supabaseAdmin
      .from("ai_usage_events")
      .select("user_id, created_at")
      .eq("operation", "talking")
      .eq("status", "completed")
      .not("first_chunk_ms", "is", null)
      .gte("created_at", since)
      .order("id")
      .range(from, to),
  ).catch(() => null);
  const firstAnswerAt = new Map<string, string>();
  for (const row of replies ?? []) {
    const known = firstAnswerAt.get(row.user_id);
    if (!known || row.created_at < known) firstAnswerAt.set(row.user_id, row.created_at);
  }
  const recentJoiners = profiles
    .filter((row) => !adminIds.has(row.id) && row.created_at >= since)
    .map((row) => ({ id: row.id, joinedAt: row.created_at }));

  return {
    today,
    ...retentionReport(students, activeDays, today),
    firstConversation: replies
      ? firstConversationStats(recentJoiners, firstAnswerAt, new Date())
      : null,
  };
}

/**
 * How long students wait for EVO in AI Speaking (last 7 days), measured in the
 * browser from the end of each answer. Null until migration 0050 is applied.
 */
export async function loadSpeakingWait(supabaseAdmin: SupabaseAdmin) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("speaking_turn_timings" as never)
    .select("transcribe_ms, first_text_ms, first_audio_ms")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return null;
  return speakingWaitSummary((data ?? []) as unknown as Parameters<typeof speakingWaitSummary>[0]);
}

/**
 * Admin "Students' goals": every student goal (active and removed, for the
 * most common titles) and the steps of the last 30 days; admins left out. Read in pages, so the
 * report never stops at PostgREST's row cap.
 */
export async function loadGoalsReport(supabaseAdmin: SupabaseAdmin) {
  const since = addDays(studyToday(), -29);
  const PAGE = 1000;
  const goals: {
    id: string;
    user_id: string;
    title: string;
    area: string;
    archived_at: string | null;
  }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("plus_goals")
      .select("id, user_id, title, area, archived_at")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Goals could not be loaded");
    goals.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  // Admins test the feature; like retention, their goals are left out.
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminIds = new Set((admins ?? []).map((row) => row.user_id));
  const studentGoals = goals.filter((goal) => !adminIds.has(goal.user_id));
  const studentGoalIds = new Set(studentGoals.map((goal) => goal.id));
  const steps: { goal_id: string; done_at: string | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("plus_goal_steps")
      .select("goal_id, done_at")
      .gte("day", since)
      .order("day", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Goal steps could not be loaded");
    steps.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return goalsReport(
    studentGoals.map((goal) => ({
      id: goal.id,
      userId: goal.user_id,
      title: goal.title,
      area: goal.area,
      archived: goal.archived_at !== null,
    })),
    steps
      .filter((step) => studentGoalIds.has(step.goal_id))
      .map((step) => ({ goalId: step.goal_id, done: step.done_at !== null })),
  );
}

/**
 * Public home funnel for the last 7 and 30 days: anonymous visits and
 * "Começar" clicks (migration 0054) next to signups, admins left out. Null
 * until the migration is applied.
 */
export async function loadLandingFunnel(supabaseAdmin: SupabaseAdmin) {
  const today = studyToday();
  const since30 = addDays(today, -29);
  const since7 = addDays(today, -6);
  const { data, error } = await supabaseAdmin
    .from("landing_daily_stats" as never)
    .select("day, event, count")
    .gte("day" as never, since30 as never);
  if (error) return null;
  const rows = (data ?? []) as unknown as LandingStatRow[];
  const [{ data: profiles }, { data: admins }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, created_at")
      .gte("created_at", new Date(`${since30}T00:00:00-03:00`).toISOString()),
    supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
  ]);
  const adminIds = new Set((admins ?? []).map((row) => row.user_id));
  const joined = (profiles ?? [])
    .filter((row) => !adminIds.has(row.id))
    .map((row) => studyToday(new Date(row.created_at)));
  return {
    week: landingFunnel(
      rows.filter((row) => row.day >= since7),
      joined.filter((day) => day >= since7).length,
      7,
    ),
    month: landingFunnel(rows, joined.length, 30),
  };
}

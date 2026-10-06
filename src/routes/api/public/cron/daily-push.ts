import { createFileRoute } from "@tanstack/react-router";

import { leagueLevelOf } from "@/lib/level";
import { studyReminder, wordOfDayBody, type PlanTaskForPush } from "@/lib/reviewReminder";
import { studyToday } from "@/lib/today";
import { weekStartOf } from "@/lib/streakFreeze";
import {
  isLeagueResetDay,
  isWeeklyReportDay,
  LEAGUE_RESET_LINE,
  leaguePositions,
  weekStartIso,
  weeklyReportMessage,
} from "@/lib/weeklyReport";

/** Small per-level fallback when the shared word bank has nothing new. */
const FALLBACK_WORDS: Record<string, { word: string; translation: string; meaning: string }[]> = {
  a1: [
    { word: "breakfast", translation: "café da manhã", meaning: "the first meal of the day" },
    { word: "neighbor", translation: "vizinho", meaning: "a person who lives near you" },
  ],
  a2: [
    {
      word: "borrow",
      translation: "pegar emprestado",
      meaning: "to take something you will give back",
    },
  ],
  b1: [{ word: "improve", translation: "melhorar", meaning: "to make something better" }],
  b2: [{ word: "outcome", translation: "resultado", meaning: "the final result of a process" }],
  c1: [
    {
      word: "nuanced",
      translation: "sutil, com nuances",
      meaning: "showing small but important differences",
    },
  ],
  c2: [{ word: "ubiquitous", translation: "onipresente", meaning: "found everywhere" }],
};

/** Constant-time comparison, so response timing never reveals the scheduler key. */
async function sameSecret(provided: string, expected: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

function hashIndex(seed: string, size: number) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return size ? h % size : 0;
}

export const Route = createFileRoute("/api/public/cron/daily-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Caller must present the scheduler key that only the database knows.
        const provided = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const { data: keyRow } = await supabaseAdmin
          .from("push_cron_key")
          .select("key")
          .eq("id", 1)
          .maybeSingle();
        if (!provided || !keyRow?.key || !(await sameSecret(provided, keyRow.key))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as { kind?: string };
        // Sunday's evening reminder becomes the weekly EVO report (one push, same schedule).
        const kind =
          body.kind === "weekly" || (body.kind === "reminder" && isWeeklyReportDay())
            ? "weekly"
            : body.kind === "reminder"
              ? "reminder"
              : "word";

        const { fcmCredentials, sendFcm } = await import("@/lib/fcm.server");
        const credentials = fcmCredentials();
        if (!credentials) {
          return Response.json({ error: "Push not configured" }, { status: 500 });
        }
        const { data: tokens, error } = await supabaseAdmin
          .from("push_tokens")
          .select("user_id, token");
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const userIds = [...new Set((tokens ?? []).map((t) => t.user_id))];
        if (userIds.length === 0) return Response.json({ sent: 0 });

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, level, max_level, last_activity_date, streak_days, league_opt_in")
          .in("id", userIds);
        // Same study day as credit_study_day (America/Sao_Paulo).
        const today = studyToday();

        const messages = new Map<string, { title: string; body: string; path: string }>();
        const weekStart = weekStartIso();

        // Weekly league: final positions per league level (the highest level
        // reached, as weekly_league groups it), from the same XP rule the
        // ranking uses (league_week_xp), for the levels of students who joined.
        const leagueByUser = new Map<string, { position: number; total: number; level: string }>();
        if (kind === "weekly") {
          const leagueWeek = weekStartOf(today);
          const levels = [
            ...new Set(
              (profiles ?? [])
                .filter((p) => p.league_opt_in)
                .map(leagueLevelOf)
                .filter((level): level is string => !!level),
            ),
          ];
          const { data: joined } = levels.length
            ? await supabaseAdmin
                .from("profiles")
                .select("id, level, max_level")
                .eq("league_opt_in", true)
            : { data: [] };
          for (const level of levels) {
            const members = (joined ?? []).filter((member) => leagueLevelOf(member) === level);
            const entries = await Promise.all(
              members.map(async (member) => {
                const { data: xp, error: xpError } = await supabaseAdmin.rpc("league_week_xp", {
                  p_user_id: member.id,
                  p_week_start: leagueWeek,
                });
                return { id: member.id, xp: typeof xp === "number" ? xp : 0, failed: !!xpError };
              }),
            );
            // A partial ranking would show wrong positions: leave the league line out.
            if (entries.some((entry) => entry.failed)) continue;
            const positions = leaguePositions(entries);
            for (const [id, position] of positions) {
              leagueByUser.set(id, { position, total: entries.length, level });
            }
          }
        }

        // Vocabulary reviews whose date has arrived (same rule as isDue): they
        // ride on the existing word and reminder pushes, never a push of their own.
        const nowIso = new Date().toISOString();
        const dueReviews = async (userId: string) => {
          const { count } = await supabaseAdmin
            .from("user_vocabulary")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .lte("next_review_at", nowIso)
            .lt("mastery_level", 100);
          return count ?? 0;
        };

        // The study plan's day to do now (today or a missed day), the same plan
        // the student sees; a failure only leaves the plan line out.
        const planTask = async (userId: string): Promise<PlanTaskForPush> => {
          try {
            const { loadStudyPlanFor } = await import("@/lib/studyPlan.server");
            const { plan } = await loadStudyPlanFor(userId);
            const next = plan.nextIndex === null ? null : plan.days[plan.nextIndex];
            return next && (next.status === "today" || next.status === "missed")
              ? { title: next.title, status: next.status }
              : null;
          } catch {
            return null;
          }
        };

        for (const p of profiles ?? []) {
          if (kind === "weekly") {
            const count = { count: "exact" as const, head: true };
            const [activities, lessons, words, reviewed] = await Promise.all([
              supabaseAdmin
                .from("activities")
                .select("duration_minutes")
                .eq("user_id", p.id)
                .gte("created_at", weekStart),
              supabaseAdmin
                .from("user_lessons")
                .select("id", count)
                .eq("user_id", p.id)
                .gte("completed_at", weekStart),
              supabaseAdmin
                .from("user_vocabulary")
                .select("id", count)
                .eq("user_id", p.id)
                .gte("created_at", weekStart),
              supabaseAdmin
                .from("learning_errors")
                .select("id", count)
                .eq("user_id", p.id)
                .gte("last_reviewed_at", weekStart),
            ]);
            const rows = activities.data ?? [];
            const message = weeklyReportMessage({
              minutes: rows.reduce((sum, row) => sum + (row.duration_minutes ?? 0), 0),
              activities: rows.length,
              lessons: lessons.count ?? 0,
              words: words.count ?? 0,
              mistakesReviewed: reviewed.count ?? 0,
              streakDays: p.streak_days ?? 0,
              league: p.league_opt_in ? (leagueByUser.get(p.id) ?? null) : null,
            });
            if (p.last_activity_date !== today) {
              message.body = `${message.body} Ainda dá tempo de cumprir a meta de hoje!`.slice(
                0,
                280,
              );
            }
            messages.set(p.id, message);
            continue;
          }
          if (kind === "reminder") {
            // last_activity_date is set only when the day's goal is met (credit_study_day).
            if (p.last_activity_date === today) continue;
            const [due, task] = await Promise.all([dueReviews(p.id), planTask(p.id)]);
            messages.set(p.id, studyReminder(due, task));
            continue;
          }
          const level = (p.level ?? "a1").toLowerCase();
          const [{ data: bank }, { data: known }, due, task] = await Promise.all([
            supabaseAdmin
              .from("vocabulary")
              .select("id, word, translation, meaning")
              .eq("level", level)
              .limit(500),
            supabaseAdmin.from("user_vocabulary").select("word_id").eq("user_id", p.id),
            dueReviews(p.id),
            planTask(p.id),
          ]);
          const knownIds = new Set((known ?? []).map((k) => k.word_id));
          const seen = new Set<string>();
          const fresh = (bank ?? []).filter((w) => {
            const key = w.word.toLowerCase();
            if (knownIds.has(w.id) || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          const pool = fresh.length ? fresh : (FALLBACK_WORDS[level] ?? FALLBACK_WORDS["a1"]!);
          const w = pool[hashIndex(`${p.id}:${today}`, pool.length)]!;
          // Monday: students in the league also hear that the ranking restarted.
          const leagueLine = p.league_opt_in && isLeagueResetDay() ? ` · ${LEAGUE_RESET_LINE}` : "";
          messages.set(p.id, {
            title: `Palavra do dia: ${w.word}`,
            body: wordOfDayBody(`${w.translation} — ${w.meaning}`, due, leagueLine, task),
            path: "/vocabulary",
          });
        }

        let sent = 0;
        const stale: string[] = [];
        for (const t of tokens ?? []) {
          const msg = messages.get(t.user_id);
          if (!msg) continue;
          const result = await sendFcm(credentials, t.token, msg, "daily-push FCM");
          if (result.ok) sent += 1;
          else if (result.stale) stale.push(t.token);
        }
        if (stale.length) await supabaseAdmin.from("push_tokens").delete().in("token", stale);

        return Response.json({ kind, sent, removed: stale.length });
      },
    },
  },
});

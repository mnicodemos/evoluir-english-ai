import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  dailyReadingEvidence,
  DAILY_READING_RUBRIC_VERSION,
} from "@/lib/pedagogy/activityEvidence";
import { measuredCefr } from "@/lib/pedagogy/cefr";
import { toleratePedagogicalFailure } from "@/lib/pedagogy/dualWrite";
import { persistActivityEvidence } from "@/lib/pedagogy/dualWriteCore";

import {
  dailyReadingMessages,
  fallbackReading,
  gradeReading,
  parseDailyReading,
  readingLevel,
  readingThemeForDay,
  type DailyReadingContent,
  type ReadingLevel,
  type ReadingTheme,
} from "./dailyReading";
import { studyDayStartIso, studyToday } from "./today";

export type DailyReading = {
  day: string;
  level: ReadingLevel;
  theme: ReadingTheme;
  /** True when the AI could not write today's text and a fixed one is shown. */
  fallback: boolean;
  /**
   * The student already finished today's reading: their answers (when
   * recorded) and score, so the page shows it done instead of asking again.
   */
  completed: { score: number | null; answers: number[] | null } | null;
} & DailyReadingContent;

/** Today's reading of the student, if they finished it (one per day). */
async function readCompletion(userId: string): Promise<DailyReading["completed"]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("activities")
    .select("score, result")
    .eq("user_id", userId)
    .eq("activity_type", "daily_reading")
    .gte("created_at", studyDayStartIso())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const result = (data.result ?? {}) as { answers?: unknown };
  const answers =
    Array.isArray(result.answers) && result.answers.every((value) => Number.isInteger(value))
      ? (result.answers as number[])
      : null;
  return { score: data.score ?? null, answers };
}

// daily_readings (migration 0072) is read through a loose table type, like the
// Life+ AI tables in life.functions.ts.
type LooseQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  maybeSingle: () => LooseQuery;
};
type LooseTable = {
  select: (columns: string) => LooseQuery;
  upsert: (rows: object, options: object) => LooseQuery;
};

async function readings(): Promise<LooseTable> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin.from as unknown as (name: string) => LooseTable)("daily_readings");
}

type ReadingRow = { theme: string; content: DailyReadingContent };

async function readStored(day: string, level: ReadingLevel) {
  const table = await readings();
  const { data, error } = await table
    .select("theme, content")
    .eq("day", day)
    .eq("level", level)
    .maybeSingle();
  if (error) return null;
  return (data as ReadingRow | null) ?? null;
}

/**
 * Today's reading for the student's level. The first student of a level on a
 * given day has it written by the AI and stored for everyone of that level;
 * the others read the stored copy with no AI call. When the AI fails, a fixed
 * reading is shown (not stored), so the page is never empty.
 */
export const loadDailyReading = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyReading> => {
    const [reading, completed] = await Promise.all([
      todaysReading(context.userId),
      readCompletion(context.userId),
    ]);
    return { ...reading, completed };
  });

/** Today's text for the student's level (the AI writes it once per level). */
async function todaysReading(userId: string): Promise<Omit<DailyReading, "completed">> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("level")
    .eq("id", userId)
    .maybeSingle();
  const level = readingLevel(profile?.level);
  const day = studyToday();
  const theme = readingThemeForDay(day);

  const stored = await readStored(day, level);
  if (stored?.content) {
    return {
      day,
      level,
      theme: stored.theme as ReadingTheme,
      fallback: false,
      ...stored.content,
    };
  }

  let content: DailyReadingContent | null = null;
  try {
    const { callGateway } = await import("./ai-gateway.server");
    const raw = await callGateway(dailyReadingMessages(level, theme, day), true, {
      userId: userId,
      operation: "lesson_generation",
      // One shared text per level and day.
      cacheKey: `daily-reading:${day}:${level}`,
    });
    content = parseDailyReading(raw, level);
    if (!content) console.error("Daily reading: the AI reply did not fit the level");
  } catch (error) {
    console.error(
      `Daily reading could not be written: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  if (!content) return { day, level, theme, fallback: true, ...fallbackReading(level) };

  // Another student of this level may have stored it meanwhile: keep theirs.
  const table = await readings();
  await table.upsert(
    { day, level, theme, content },
    { onConflict: "day,level", ignoreDuplicates: true },
  );
  const winner = await readStored(day, level);
  if (winner?.content) {
    return {
      day,
      level,
      theme: winner.theme as ReadingTheme,
      fallback: false,
      ...winner.content,
    };
  }
  return { day, level, theme, fallback: false, ...content };
}

/** The same operation key for a student's reading of a given day (UUID shape). */
async function readingOperationKey(userId: string, day: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`daily-reading:${userId}:${day}`),
    ),
  );
  const hex = [...bytes.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Today's reading finished: every question answered (any score). Graded here
 * against the stored text, recorded once a day as an activities row of type
 * "daily_reading", which closes the study day in credit_study_day (migration
 * 0073). Its minutes stay in the "reading" telemetry rows. Each answer is also
 * Reading evidence (migration 0074), the source of the Reading score.
 */
export const completeDailyReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        answers: z.array(z.number().int().min(0).max(3)).min(1).max(8),
        /** The student saw the fixed text (the AI had failed). */
        fallback: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("level")
      .eq("id", context.userId)
      .maybeSingle();
    const level = readingLevel(profile?.level);
    const day = studyToday();
    const stored = data.fallback ? null : await readStored(day, level);
    const reading = stored?.content ?? fallbackReading(level);
    if (data.answers.length !== reading.questions.length) {
      throw new Error("Answer every question of today's reading.");
    }
    const { score } = gradeReading(reading.questions, data.answers);
    const operationKey = await readingOperationKey(context.userId, day);

    const { error } = await supabaseAdmin.rpc("persist_authoritative_legacy_activity", {
      p_user_id: context.userId,
      p_source_type: "telemetry",
      p_operation_key: operationKey,
      p_source_id: null as unknown as string,
      p_activity_type: "daily_reading",
      p_title: `Daily reading: ${reading.title}`,
      p_duration_minutes: 0,
      p_score: score,
      p_scores: {},
      p_result: { level, day, answers: data.answers },
    });
    if (error) {
      console.error(`Daily reading could not be recorded: ${error.message}`);
      throw new Error("Your reading could not be saved.");
    }
    // Once a day per student (same operation key); a failure is recorded and
    // never breaks the reading the student just finished.
    await toleratePedagogicalFailure(async () =>
      persistActivityEvidence({
        userId: context.userId,
        sourceType: "reading",
        operationKey,
        rubricVersion: DAILY_READING_RUBRIC_VERSION,
        evidence: dailyReadingEvidence({
          correct: reading.questions.map(
            (question, index) => data.answers[index] === question.answer,
          ),
          day,
          itemCefr: measuredCefr(level.toUpperCase()),
        }),
      }),
    );
    return { score };
  });

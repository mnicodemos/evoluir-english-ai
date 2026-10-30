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
  READING_CATEGORIES,
  READING_STYLES,
  readingLevel,
  readingThemeForDay,
  readingWeekDays,
  todaysPickForDay,
  type DailyReadingContent,
  type ReadingChoice,
  type ReadingLevel,
  type ReadingTheme,
} from "./dailyReading";
import { studyToday } from "./today";

export type DailyReading = {
  day: string;
  level: ReadingLevel;
  theme: ReadingTheme;
  /** True when the AI could not write today's text and a fixed one is shown. */
  fallback: boolean;
  /** The category and style the student chose; null for "Today's pick". */
  choice: ReadingChoice | null;
  /**
   * A text of an earlier day of the week, opened again from the reading week:
   * practice only, it never closes a study day.
   */
  past: boolean;
  /**
   * The student already finished today's reading: their answers (when
   * recorded), score and the text they read (choice), so the page shows it
   * done instead of asking again. Other texts of the day are practice only.
   */
  completed: {
    score: number | null;
    answers: number[] | null;
    choice: ReadingChoice | null;
  } | null;
} & DailyReadingContent;

const choiceSchema = z
  .object({ category: z.enum(READING_CATEGORIES), style: z.enum(READING_STYLES) })
  .strict()
  .nullable();

/** The instant a São Paulo study day began, as a UTC ISO string. */
function dayStartIso(day: string) {
  return new Date(`${day}T00:00:00-03:00`).toISOString();
}

/** The student's reading of a day (today by default), if they finished it (one per day). */
async function readCompletion(
  userId: string,
  day: string = studyToday(),
): Promise<DailyReading["completed"]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const next = new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("activities")
    .select("score, result")
    .eq("user_id", userId)
    .eq("activity_type", "daily_reading")
    .gte("created_at", dayStartIso(day))
    .lt("created_at", dayStartIso(next))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const result = (data.result ?? {}) as { answers?: unknown; choice?: unknown };
  const answers =
    Array.isArray(result.answers) && result.answers.every((value) => Number.isInteger(value))
      ? (result.answers as number[])
      : null;
  const choice = choiceSchema.safeParse(result.choice ?? null);
  return { score: data.score ?? null, answers, choice: choice.success ? choice.data : null };
}

// daily_readings (migration 0072) and daily_reading_variants (0079) are read
// through a loose table type, like the Life+ AI tables in life.functions.ts.
type LooseQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  maybeSingle: () => LooseQuery;
};
type LooseTable = {
  select: (columns: string) => LooseQuery;
  upsert: (rows: object, options: object) => LooseQuery;
};

async function readings(choice: ReadingChoice | null = null): Promise<LooseTable> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin.from as unknown as (name: string) => LooseTable)(
    choice ? "daily_reading_variants" : "daily_readings",
  );
}

type ReadingRow = { theme?: string; content: DailyReadingContent };

async function readStored(day: string, level: ReadingLevel, choice: ReadingChoice | null = null) {
  const table = await readings(choice);
  let query = table
    .select(choice ? "content" : "theme, content")
    .eq("day", day)
    .eq("level", level);
  if (choice) query = query.eq("category", choice.category).eq("style", choice.style);
  const { data, error } = await query.maybeSingle();
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
  .inputValidator((input: unknown) =>
    z
      .object({
        choice: choiceSchema.optional(),
        /** An earlier day of the week to read again; today when absent. */
        day: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .strict()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DailyReading> => {
    const today = studyToday();
    if (data.day && data.day !== today) {
      return pastReading(context.userId, data.day, data.choice ?? null);
    }
    const [reading, completed] = await Promise.all([
      todaysReading(context.userId, data.choice ?? null),
      readCompletion(context.userId),
    ]);
    return { ...reading, past: false, completed };
  });

/**
 * A text of the last seven days, read again (owner request, 2026-10-30: each
 * day was isolated). Only a stored text: no AI call for a past day. The
 * student's answers of that day come back with it; answering again is
 * practice on the device.
 */
async function pastReading(
  userId: string,
  day: string,
  choice: ReadingChoice | null,
): Promise<DailyReading> {
  if (!readingWeekDays(studyToday()).includes(day)) {
    throw new Error("Only the readings of the last seven days can be opened again.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("level")
    .eq("id", userId)
    .maybeSingle();
  const level = readingLevel(profile?.level);
  const [stored, completed] = await Promise.all([
    readStored(day, level, choice),
    readCompletion(userId, day),
  ]);
  if (!stored?.content) throw new Error("This reading is no longer available.");
  const theme = (stored.theme as ReadingTheme | undefined) ?? readingThemeForDay(day);
  return { day, level, theme, fallback: false, choice, past: true, completed, ...stored.content };
}

export type ReadingWeekDay = {
  day: string;
  /** Finished that day (the study-day reading). */
  done: boolean;
  score: number | null;
  /** The text read that day: its category and style, or null for the day's pick. */
  choice: ReadingChoice | null;
  /** A stored text the student can open again (never today, which is the page itself). */
  available: boolean;
};

/**
 * The student's last seven days of reading for the week strip: which days
 * were finished, with the score, and which earlier texts can be read again.
 */
export const loadReadingWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReadingWeekDay[]> => {
    const today = studyToday();
    const days = readingWeekDays(today);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("level").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("activities")
        .select("score, result, created_at")
        .eq("user_id", context.userId)
        .eq("activity_type", "daily_reading")
        .gte("created_at", dayStartIso(days[0]!))
        .order("created_at", { ascending: true })
        .limit(20),
    ]);
    const level = readingLevel(profile?.level);
    const byDay = new Map<string, { score: number | null; choice: ReadingChoice | null }>();
    for (const row of rows ?? []) {
      const result = (row.result ?? {}) as { day?: unknown; choice?: unknown };
      const day =
        typeof result.day === "string" ? result.day : studyToday(new Date(row.created_at));
      const choice = choiceSchema.safeParse(result.choice ?? null);
      byDay.set(day, { score: row.score ?? null, choice: choice.success ? choice.data : null });
    }
    return Promise.all(
      days.map(async (day) => {
        const read = byDay.get(day);
        const choice = read?.choice ?? null;
        const available =
          day !== today && !!(await readStored(day, level, choice).catch(() => null))?.content;
        return { day, done: !!read, score: read?.score ?? null, choice, available };
      }),
    );
  });

/**
 * Today's text for the student's level (the AI writes it once per level), or
 * the text of the category and style they chose (once per level, day,
 * category and style, in daily_reading_variants).
 */
async function todaysReading(
  userId: string,
  choice: ReadingChoice | null,
): Promise<Omit<DailyReading, "completed" | "past">> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("level")
    .eq("id", userId)
    .maybeSingle();
  const level = readingLevel(profile?.level);
  const day = studyToday();
  const theme = readingThemeForDay(day);

  const storedTheme = (row: ReadingRow) => (row.theme as ReadingTheme | undefined) ?? theme;

  const stored = await readStored(day, level, choice);
  if (stored?.content) {
    return { day, level, theme: storedTheme(stored), fallback: false, choice, ...stored.content };
  }

  let content: DailyReadingContent | null = null;
  try {
    const { callGateway } = await import("./ai-gateway.server");
    // Today's pick writes the subject of the day's rotation (stored as the day's text).
    const subject = choice ?? todaysPickForDay(day);
    const raw = await callGateway(dailyReadingMessages(level, theme, day, subject), true, {
      userId: userId,
      operation: "lesson_generation",
      // One shared text per level and day (and per category and style).
      cacheKey: choice
        ? `daily-reading:${day}:${level}:${choice.category}:${choice.style}`
        : `daily-reading:${day}:${level}`,
    });
    content = parseDailyReading(raw, level);
    if (!content) console.error("Daily reading: the AI reply did not fit the level");
  } catch (error) {
    console.error(
      `Daily reading could not be written: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  if (!content) {
    // The fixed texts: an everyday story at A1-A2, a reflection on habits above.
    const fallbackTheme: ReadingTheme = level === "a1" || level === "a2" ? "story" : "motivational";
    return { day, level, theme: fallbackTheme, fallback: true, choice, ...fallbackReading(level) };
  }

  // Another student of this level may have stored it meanwhile: keep theirs.
  const table = await readings(choice);
  await table.upsert(
    choice
      ? { day, level, category: choice.category, style: choice.style, content }
      : { day, level, theme, content },
    {
      onConflict: choice ? "day,level,category,style" : "day,level",
      ignoreDuplicates: true,
    },
  );
  const winner = await readStored(day, level, choice);
  if (winner?.content) {
    return { day, level, theme: storedTheme(winner), fallback: false, choice, ...winner.content };
  }
  return { day, level, theme, fallback: false, choice, ...content };
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
        /** The category and style read; null or absent for "Today's pick". */
        choice: choiceSchema.optional(),
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
    const choice = data.choice ?? null;
    const stored = data.fallback ? null : await readStored(day, level, choice);
    // A chosen text is graded only against its stored copy.
    if (choice && !data.fallback && !stored?.content) {
      throw new Error("Your reading could not be saved.");
    }
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
      p_result: { level, day, answers: data.answers, choice },
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

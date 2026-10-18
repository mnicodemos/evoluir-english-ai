import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  dailyReadingMessages,
  fallbackReading,
  parseDailyReading,
  readingLevel,
  readingThemeForDay,
  type DailyReadingContent,
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
} & DailyReadingContent;

// daily_readings (migration 0073) is not in the generated types until Lovable
// regenerates them, like the Life+ AI tables in life.functions.ts.
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("level")
      .eq("id", context.userId)
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
        userId: context.userId,
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
  });

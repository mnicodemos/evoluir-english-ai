/**
 * Keep improving's free rows (user request, 2026-10-24: the bell listed new
 * activities while the card said "All reviews done"): after due words, due
 * mistakes and the review suggestions, the rows left are filled with today's
 * new activities, the same ones the bell lists, marked "New today" so they
 * never read as reviews. A destination another Dashboard button already
 * opens is left out.
 */

export type NewTodayRow = {
  key: "reading" | "writing" | "vocabulary" | "listening";
  to: "/reading" | "/writing" | "/vocabulary" | "/listening";
  /** English source; the screen translates it. */
  title: string;
  line: string;
};

const ROWS: readonly NewTodayRow[] = [
  {
    key: "reading",
    to: "/reading",
    title: "Daily reading",
    line: "Today's text is waiting: read it and answer the questions.",
  },
  {
    key: "writing",
    to: "/writing",
    title: "Writing",
    line: "New writing tasks are ready for you.",
  },
  {
    key: "vocabulary",
    to: "/vocabulary",
    title: "Vocabulary",
    line: "New words are ready to learn.",
  },
  {
    key: "listening",
    to: "/listening",
    title: "Listening",
    line: "A session of 9 sentences is waiting.",
  },
];

export function newTodayRows(input: {
  /** Undefined while unknown: the reading row waits instead of guessing. */
  readingDone: boolean | undefined;
  indicators: { listening: boolean; writing: boolean; vocabulary: boolean };
  /** Destinations already shown or opened by another Dashboard button. */
  taken: readonly string[];
  slots: number;
}): NewTodayRow[] {
  if (input.slots <= 0) return [];
  const taken = new Set(input.taken.map((to) => to.split("?")[0]));
  const open: Record<NewTodayRow["key"], boolean> = {
    reading: input.readingDone === false,
    writing: input.indicators.writing,
    vocabulary: input.indicators.vocabulary,
    listening: input.indicators.listening,
  };
  return ROWS.filter((row) => open[row.key] && !taken.has(row.to)).slice(0, input.slots);
}

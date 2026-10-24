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

/**
 * Practice that never runs out, for the rows still free while today's minutes
 * goal is open (user decision, 2026-10-24: three rows until the goal is met,
 * so there is always a next step; once it is met and nothing is pending, the
 * card shows its done state with one optional "go further" link instead).
 */
export type ContinueRow = {
  key: "coach" | "teacher" | "reading" | "learning";
  to: "/coach" | "/teacher" | "/reading" | "/learning";
  title: string;
  line: string;
};

const CONTINUE_ROWS: readonly ContinueRow[] = [
  {
    key: "coach",
    to: "/coach",
    title: "Talk to EVO",
    line: "A short conversation keeps your speaking moving.",
  },
  {
    key: "teacher",
    to: "/teacher",
    title: "AI Teacher",
    line: "Ask a question or practise with exercises.",
  },
  {
    key: "reading",
    to: "/reading",
    title: "Read another text",
    line: "Pick a new text by theme and style.",
  },
  {
    key: "learning",
    to: "/learning",
    title: "Next lesson",
    line: "Continue your learning path.",
  },
];

export function continueRows(input: {
  /** Today's minutes goal is met: no filler rows then. */
  goalReached: boolean;
  /** Destinations already shown or opened by another Dashboard button. */
  taken: readonly string[];
  slots: number;
}): ContinueRow[] {
  if (input.goalReached || input.slots <= 0) return [];
  const taken = new Set(input.taken.map((to) => to.split("?")[0]));
  return CONTINUE_ROWS.filter((row) => !taken.has(row.to)).slice(0, input.slots);
}

/** The one optional link under the done state: EVO first, else the AI Teacher. */
export function goFurtherRow(taken: readonly string[]): ContinueRow {
  const open = new Set(taken.map((to) => to.split("?")[0]));
  return open.has("/coach") ? CONTINUE_ROWS[1]! : CONTINUE_ROWS[0]!;
}

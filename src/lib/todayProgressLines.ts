/**
 * The three lines of the Dashboard's Today's Progress (user request): they
 * follow what the student actually did today, so every activity whose minutes
 * fill the ring also shows up beside it. Lessons, words and accuracy keep the
 * empty slots when fewer than three activities happened.
 */

export type TodayLineIcon =
  | "lesson"
  | "words"
  | "accuracy"
  | "conversation"
  | "writing"
  | "listening"
  | "mistakes"
  | "teacher"
  | "flashcards"
  | "pronunciation"
  | "test"
  | "meditation"
  | "time";

export type TodayLineState = "done" | "attention" | "empty";

export type TodayLine = {
  key: string;
  icon: TodayLineIcon;
  /** English source label, translated by the screen (uiPt). */
  label: string;
  value: string;
  state: TodayLineState;
};

export type TodayActivityRow = { activity_type: string; duration_minutes: number | null };

/** Accuracy at or above this shows as done; below it (but above 0) needs attention. */
export const TODAY_ACCURACY_DONE = 70;

const LINE_COUNT = 3;

function countOf(rows: TodayActivityRow[], types: string[]) {
  return rows.filter((row) => types.includes(row.activity_type)).length;
}

function minutesOf(rows: TodayActivityRow[], types: string[]) {
  return rows
    .filter((row) => types.includes(row.activity_type))
    .reduce((sum, row) => sum + Math.max(0, row.duration_minutes ?? 0), 0);
}

export function todayProgressLines(input: {
  lessonsCompleted: number;
  wordsMastered: number;
  accuracy: number;
  activities: TodayActivityRow[];
}): TodayLine[] {
  const rows = input.activities;
  const lessonMinutes = minutesOf(rows, ["lesson_practice"]);
  const teacherMinutes = minutesOf(rows, ["teacher"]);
  const accuracyState: TodayLineState =
    input.accuracy >= TODAY_ACCURACY_DONE ? "done" : input.accuracy > 0 ? "attention" : "empty";

  // In order of weight: what completes a study day first, then the rest.
  const candidates: Array<TodayLine & { active: boolean }> = [
    {
      key: "lessons",
      icon: "lesson",
      label: "Lessons completed",
      value: String(input.lessonsCompleted),
      state: input.lessonsCompleted > 0 ? "done" : "empty",
      active: input.lessonsCompleted > 0,
    },
    (() => {
      const count = countOf(rows, ["conversation", "video_call"]);
      return {
        key: "conversations",
        icon: "conversation" as const,
        label: count === 1 ? "Conversation with EVO" : "Conversations with EVO",
        value: String(count),
        state: count > 0 ? ("done" as const) : ("empty" as const),
        active: count > 0,
      };
    })(),
    (() => {
      const count = countOf(rows, ["writing"]);
      return {
        key: "writing",
        icon: "writing" as const,
        label: count === 1 ? "Text corrected" : "Texts corrected",
        value: String(count),
        state: count > 0 ? ("done" as const) : ("empty" as const),
        active: count > 0,
      };
    })(),
    (() => {
      const count = countOf(rows, ["listening"]);
      return {
        key: "listening",
        icon: "listening" as const,
        label: count === 1 ? "Listening session" : "Listening sessions",
        value: String(count),
        state: count > 0 ? ("done" as const) : ("empty" as const),
        active: count > 0,
      };
    })(),
    {
      key: "words",
      icon: "words",
      label: "Words mastered",
      value: String(input.wordsMastered),
      state: input.wordsMastered > 0 ? "done" : "empty",
      active: input.wordsMastered > 0,
    },
    (() => {
      const count = countOf(rows, ["mistakes_review"]);
      return {
        key: "mistakes",
        icon: "mistakes" as const,
        label: count === 1 ? "Mistakes review" : "Mistakes reviews",
        value: String(count),
        state: count > 0 ? ("done" as const) : ("empty" as const),
        active: count > 0,
      };
    })(),
    {
      key: "teacher",
      icon: "teacher",
      label: "min with AI Teacher",
      value: String(teacherMinutes),
      state: teacherMinutes > 0 ? "done" : "empty",
      active: teacherMinutes > 0,
    },
    (() => {
      const count = countOf(rows, ["flashcards"]);
      return {
        key: "flashcards",
        icon: "flashcards" as const,
        label: count === 1 ? "Flashcard review" : "Flashcard reviews",
        value: String(count),
        state: count > 0 ? ("done" as const) : ("empty" as const),
        active: count > 0,
      };
    })(),
    (() => {
      const count = countOf(rows, ["vocabulary"]);
      return {
        key: "pronunciation",
        icon: "pronunciation" as const,
        label: count === 1 ? "Pronunciation practice" : "Pronunciation practices",
        value: String(count),
        state: count > 0 ? ("done" as const) : ("empty" as const),
        active: count > 0,
      };
    })(),
    (() => {
      const count = countOf(rows, ["final_test"]);
      return {
        key: "final-test",
        icon: "test" as const,
        label: "Final Test",
        value: String(count),
        state: count > 0 ? ("done" as const) : ("empty" as const),
        active: count > 0,
      };
    })(),
    {
      key: "meditation",
      icon: "meditation",
      label: "min of meditation",
      value: String(minutesOf(rows, ["meditation"])),
      state: minutesOf(rows, ["meditation"]) > 0 ? "done" : "empty",
      active: minutesOf(rows, ["meditation"]) > 0,
    },
    {
      key: "accuracy",
      icon: "accuracy",
      label: "Accuracy",
      value: `${input.accuracy}%`,
      state: accuracyState,
      active: input.accuracy > 0,
    },
    // Time on a lesson page before its quiz, when no lesson was finished yet.
    {
      key: "lesson-time",
      icon: "time",
      label: "min on lessons",
      value: String(lessonMinutes),
      state: lessonMinutes > 0 ? "done" : "empty",
      active: lessonMinutes > 0 && input.lessonsCompleted === 0,
    },
  ];

  const picked = candidates.filter((line) => line.active).slice(0, LINE_COUNT);
  // Fewer than three activities: the classic lines keep the card's shape.
  for (const key of ["lessons", "words", "accuracy"]) {
    if (picked.length >= LINE_COUNT) break;
    if (picked.some((line) => line.key === key)) continue;
    picked.push(candidates.find((line) => line.key === key)!);
  }
  return picked.map(({ active: _active, ...line }) => line);
}

/**
 * "Take the challenge" with a goal for the day (user request): the challenge
 * names how much to do (3 texts, 3 Listening sessions, 1 conversation, 10
 * minutes with the AI Teacher, 1 lesson), shows the progress from today's
 * activities and leaves the Dashboard once the goal is reached. The XP shown
 * is what the weekly league already gives each activity (league_week_xp:
 * lesson 50, writing/listening/conversation 20, reviewed word 2, reviewed
 * mistake 5); the AI Teacher earns no league XP.
 */

export type ChallengeActivityRow = { activity_type: string; duration_minutes: number | null };

export type DailyChallengeGoal = {
  target: number;
  done: number;
  /** English source unit for "1/3 texts" (translated by the screen). */
  unit: string;
  reached: boolean;
};

type GoalRule = { target: number; unit: string; types: string[]; measure: "count" | "minutes" };

const GOALS: Record<string, GoalRule> = {
  "/writing": { target: 3, unit: "texts", types: ["writing"], measure: "count" },
  "/listening": { target: 3, unit: "sessions", types: ["listening"], measure: "count" },
  "/coach": {
    target: 1,
    unit: "conversations",
    types: ["conversation", "video_call"],
    measure: "count",
  },
  "/call": {
    target: 1,
    unit: "conversations",
    types: ["conversation", "video_call"],
    measure: "count",
  },
  "/teacher": { target: 10, unit: "min", types: ["teacher"], measure: "minutes" },
  "/learning/$lessonId": { target: 1, unit: "lessons", types: ["lesson"], measure: "count" },
};

/** The day's goal for a challenge destination, or null when it has none
 *  (Vocabulary leaves once no word is due, through the activity indicators). */
export function dailyChallengeGoal(
  destination: string,
  activities: ChallengeActivityRow[],
): DailyChallengeGoal | null {
  const rule = GOALS[destination.split("?")[0]!];
  if (!rule) return null;
  const rows = activities.filter((row) => rule.types.includes(row.activity_type));
  const done =
    rule.measure === "count"
      ? rows.length
      : rows.reduce((sum, row) => sum + Math.max(0, row.duration_minutes ?? 0), 0);
  return {
    target: rule.target,
    done: Math.min(done, rule.target),
    unit: rule.unit,
    reached: done >= rule.target,
  };
}

/** League XP the destination's activity earns, as a short English label. */
export function practiceXpLabel(destination: string): string | null {
  const path = destination.split("?")[0]!;
  if (path === "/learning/$lessonId") return "+50 XP";
  if (path === "/writing" || path === "/listening" || path === "/coach" || path === "/call")
    return "+20 XP";
  if (path === "/mistakes") return "+5 XP";
  if (path === "/vocabulary") return "+2 XP";
  return null;
}

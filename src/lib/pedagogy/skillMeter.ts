// Presentation of the Dashboard "Your English Skills" card. It reads the SAME
// per-skill snapshots the next step was decided from (weighted evidence,
// minimum evidence, confidence), so the card and "Today's priority" always
// agree. Nothing here changes a score; it only labels what the server sent.

export type SkillMeterSnapshot = {
  skill: string;
  score: number | null;
  cefrLevel: string;
  evidenceCount?: number | null;
};

export type SkillMeterStatus = "priority" | "strong" | "on_track" | "needs_work" | "not_measured";

export type SkillMeterRow = {
  skill: string;
  /** null when the skill has not been measured yet. */
  value: number | null;
  status: SkillMeterStatus;
  evidenceCount: number;
};

/**
 * Skills shown on the card. Reading has no evidence source in the app, so
 * Grammar (fed by lesson quizzes and writing) takes its place: finishing
 * lessons now moves a bar.
 */
export const SKILL_METER_SKILLS = ["listening", "speaking", "writing", "grammar"] as const;

export const SKILL_STRONG_AT = 85;
export const SKILL_ON_TRACK_AT = 65;

export function skillMeterRows(
  snapshots: readonly SkillMeterSnapshot[] | null | undefined,
  prioritySkill: string | null | undefined,
): SkillMeterRow[] {
  return SKILL_METER_SKILLS.map((skill) => {
    const snapshot = (snapshots ?? []).find((item) => item.skill === skill);
    const measured =
      !!snapshot &&
      snapshot.score !== null &&
      Number.isFinite(snapshot.score) &&
      snapshot.cefrLevel !== "insufficient_evidence";
    const value = measured ? Math.round(Math.min(100, Math.max(0, snapshot!.score!))) : null;
    const evidenceCount = Math.max(0, Math.round(snapshot?.evidenceCount ?? 0));
    // "Priority" belongs only to the skill EVO chose, one at a time.
    const status: SkillMeterStatus =
      skill === prioritySkill
        ? "priority"
        : value === null
          ? "not_measured"
          : value >= SKILL_STRONG_AT
            ? "strong"
            : value >= SKILL_ON_TRACK_AT
              ? "on_track"
              : "needs_work";
    return { skill, value, status, evidenceCount };
  });
}

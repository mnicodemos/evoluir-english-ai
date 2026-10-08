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

export type SkillMeterStatus =
  | "priority"
  | "strong"
  | "on_track"
  | "needs_work"
  | "not_measured"
  /** Measured, but at another level than the student's current one. */
  | "other_level";

export type SkillMeterRow = {
  skill: string;
  /** null when the skill has not been measured yet. */
  value: number | null;
  status: SkillMeterStatus;
  evidenceCount: number;
  /**
   * The CEFR level the score was measured at, when it is not the student's
   * current level (e.g. "B2" after moving up to C1); null otherwise.
   */
  otherLevel: string | null;
};

/**
 * Skills shown on the card. Reading has no evidence source in the app, so
 * Grammar (fed by lesson quizzes and writing) takes its place: finishing
 * lessons now moves a bar.
 */
export const SKILL_METER_SKILLS = ["listening", "speaking", "writing", "grammar"] as const;

export const SKILL_STRONG_AT = 85;
export const SKILL_ON_TRACK_AT = 65;

/** My Progress shows every skill the app measures, with the same rules. */
export const PROGRESS_SKILLS = [
  "listening",
  "speaking",
  "writing",
  "reading",
  "grammar",
  "vocabulary",
] as const;

export function skillMeterRows(
  snapshots: readonly SkillMeterSnapshot[] | null | undefined,
  prioritySkill: string | null | undefined,
  skills: readonly string[] = SKILL_METER_SKILLS,
  currentLevel?: string | null,
): SkillMeterRow[] {
  return skills.map((skill) => {
    const snapshot = (snapshots ?? []).find((item) => item.skill === skill);
    const measured =
      !!snapshot &&
      snapshot.score !== null &&
      Number.isFinite(snapshot.score) &&
      snapshot.cefrLevel !== "insufficient_evidence";
    const value = measured ? Math.round(Math.min(100, Math.max(0, snapshot!.score!))) : null;
    const evidenceCount = Math.max(0, Math.round(snapshot?.evidenceCount ?? 0));
    // After a level change the last score stays visible, tagged with the
    // level it came from: EVO decides the priority from the current level
    // only, so an old 82% can be the priority until it is measured again.
    const measuredAt = measured ? snapshot!.cefrLevel.toUpperCase() : null;
    const otherLevel =
      measuredAt && currentLevel && measuredAt !== currentLevel.toUpperCase() ? measuredAt : null;
    // "Priority" belongs only to the skill EVO chose, one at a time.
    const status: SkillMeterStatus =
      skill === prioritySkill
        ? "priority"
        : value === null
          ? "not_measured"
          : otherLevel
            ? "other_level"
            : value >= SKILL_STRONG_AT
              ? "strong"
              : value >= SKILL_ON_TRACK_AT
                ? "on_track"
                : "needs_work";
    return { skill, value, status, evidenceCount, otherLevel };
  });
}

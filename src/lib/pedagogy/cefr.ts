import { scoreSchema, type CefrLevel } from "./contracts";

export type CefrBand = {
  level: Exclude<CefrLevel, "insufficient_evidence">;
  minimumScore: number;
  maximumScore: number;
};

export type CefrRuleset = {
  version: string;
  certificationEquivalence: false;
  bands: readonly CefrBand[];
};

/** Technical starting rules only; these are not an official CEFR certification equivalence. */
export const INITIAL_CEFR_RULESET: CefrRuleset = {
  // v2 keeps the same bands and adds the item-level calibration below, so the
  // rule version recorded with every skill result stays traceable.
  version: "cefr-score-v2",
  certificationEquivalence: false,
  bands: [
    { level: "A1", minimumScore: 0, maximumScore: 29 },
    { level: "A2", minimumScore: 30, maximumScore: 44 },
    { level: "B1", minimumScore: 45, maximumScore: 59 },
    { level: "B2", minimumScore: 60, maximumScore: 74 },
    { level: "C1", minimumScore: 75, maximumScore: 89 },
    { level: "C2", minimumScore: 90, maximumScore: 100 },
  ],
};

export function cefrForScore(
  score: number,
  ruleset: CefrRuleset = INITIAL_CEFR_RULESET,
): Exclude<CefrLevel, "insufficient_evidence"> {
  const validScore = scoreSchema.parse(score);
  const band = ruleset.bands.find(
    ({ minimumScore, maximumScore }) => validScore >= minimumScore && validScore <= maximumScore,
  );
  if (!band) throw new RangeError(`No CEFR band configured for score ${validScore}`);
  return band.level;
}

import { describe, expect, it } from "vitest";

import {
  cleanDecisionAnalysis,
  cleanRatings,
  decisionAnalysisPrompt,
  decisionGoalTitle,
  decisionInputSchema,
  decisionResult,
  ratingKey,
  starterDecision,
  type DecisionInput,
} from "./lifeDecisions";

const career: DecisionInput = {
  title: "Own consultancy or senior job?",
  context: "",
  options: [
    { id: "a1", name: "Open my consultancy" },
    { id: "a2", name: "Accept the senior job" },
  ],
  criteria: [
    { id: "c1", name: "Income growth", weight: 5 },
    { id: "c2", name: "Stability", weight: 4 },
    { id: "c3", name: "Flexibility", weight: 4 },
    { id: "c4", name: "Purpose", weight: 5 },
  ],
  ratings: {
    "a1:c1": 9,
    "a1:c2": 4,
    "a1:c3": 10,
    "a1:c4": 10,
    "a2:c1": 7,
    "a2:c2": 9,
    "a2:c3": 5,
    "a2:c4": 6,
  },
};

describe("decision result", () => {
  it("is the weighted average of the scores, on 1-10", () => {
    const result = decisionResult(career);
    // a1: (45 + 16 + 40 + 50) / 18 = 8.39; a2: (35 + 36 + 20 + 30) / 18 = 6.72
    expect(result.ranking.map((score) => [score.optionId, score.score])).toEqual([
      ["a1", 8.39],
      ["a2", 6.72],
    ]);
    expect(result.winner?.name).toBe("Open my consultancy");
    expect(result.winner?.percent).toBe(84);
    expect(result.closeCall).toBe(false);
    expect(result.missing).toBe(0);
  });

  it("lets the what-if weights flip the result", () => {
    const result = decisionResult(career, { c2: 5, c3: 1, c4: 1, c1: 1 });
    expect(result.winner?.optionId).toBe("a2");
  });

  it("flags a close call under 5% and counts missing scores as 0", () => {
    const close = decisionResult({
      ...career,
      criteria: [{ id: "c1", name: "Income", weight: 3 }],
      ratings: { "a1:c1": 8, "a2:c1": 8 },
    });
    expect(close.closeCall).toBe(true);
    // Ties keep the order the options were written in.
    expect(close.winner?.optionId).toBe("a1");

    const partial = decisionResult({ ...career, ratings: { "a1:c1": 9 } });
    expect(partial.missing).toBe(7);
    expect(partial.winner?.score).toBe(2.5);
  });

  it("has no winner until something is scored", () => {
    expect(decisionResult({ ...career, ratings: {} }).winner).toBeNull();
  });
});

describe("decision input", () => {
  it("keeps only the scores of options and criteria that still exist", () => {
    const ratings = cleanRatings({
      ...career,
      options: [career.options[0]!],
      ratings: { ...career.ratings, "gone:c1": 3 },
    });
    expect(Object.keys(ratings)).toEqual(["a1:c1", "a1:c2", "a1:c3", "a1:c4"]);
    expect(ratingKey("a1", "c1")).toBe("a1:c1");
  });

  it("validates the limits", () => {
    expect(decisionInputSchema.safeParse(career).success).toBe(true);
    expect(decisionInputSchema.safeParse({ ...career, options: [career.options[0]] }).success).toBe(
      false,
    );
    expect(
      decisionInputSchema.safeParse({
        ...career,
        criteria: [{ id: "c1", name: "x", weight: 6 }],
      }).success,
    ).toBe(false);
    expect(decisionInputSchema.safeParse({ ...career, ratings: { "a1:c1": 11 } }).success).toBe(
      false,
    );
    expect(
      decisionInputSchema.safeParse({
        ...career,
        options: [career.options[0], career.options[0]],
      }).success,
    ).toBe(false);
  });

  it("starts a new decision with two options and two criteria that validate once titled", () => {
    const starter = starterDecision((label) => label);
    expect(starter.options).toHaveLength(2);
    expect(starter.criteria).toHaveLength(2);
    expect(decisionInputSchema.safeParse({ ...starter, title: "Which course?" }).success).toBe(
      true,
    );
  });
});

describe("EVO's analysis", () => {
  it("sends the matrix and its result as data, in the student's language", () => {
    const [system, user] = decisionAnalysisPrompt({ lang: "pt", decision: career });
    expect(system!.content).toContain("Brazilian Portuguese");
    expect(system!.content).toContain('"leader":"Open my consultancy"');
    expect(system!.content).toContain("never give medical");
    expect(user!.content).toBe("Analise a minha decisão.");
  });

  it("cleans the reply and refuses an empty one", () => {
    expect(cleanDecisionAnalysis("```markdown\n**Result**: option A leads.\n```")).toBe(
      "**Result**: option A leads.",
    );
    expect(cleanDecisionAnalysis("ok")).toBeNull();
  });

  it("names the goal after the chosen option", () => {
    expect(decisionGoalTitle("  Open my consultancy ")).toBe("Open my consultancy");
    expect(decisionGoalTitle("A")).toBe("A ✓");
  });
});

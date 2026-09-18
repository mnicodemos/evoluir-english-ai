import { describe, expect, it } from "vitest";

import { aggregateSkillEvidence } from "./aggregateSkill";
import { cefrForScore } from "./cefr";
import { assertConfidence } from "./confidence";
import {
  parseQuizDetails,
  quizEvidence,
  toleratePedagogicalFailure,
  writingEvidence,
  writingSubmissionRecord,
} from "./dualWrite";
import {
  CEFR_LEVELS,
  cefrLevelSchema,
  PEDAGOGICAL_SKILLS,
  pedagogicalSkillSchema,
  scoreSchema,
  type AssessmentEvidence,
  type PedagogicalSkill,
} from "./contracts";
import {
  authoritativeQuizInputSchema,
  authoritativeWritingInputSchema,
  gradeQuizAnswers,
} from "./authoritativeSources";

const boundaries = [
  [0, "A1"],
  [29, "A1"],
  [30, "A2"],
  [44, "A2"],
  [45, "B1"],
  [59, "B1"],
  [60, "B2"],
  [74, "B2"],
  [75, "C1"],
  [89, "C1"],
  [90, "C2"],
  [100, "C2"],
] as const;

describe("CEFR rules", () => {
  it.each(boundaries)("maps %i to %s", (score, cefr) => {
    expect(cefrForScore(score)).toBe(cefr);
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY, null])(
    "rejects invalid score %s",
    (score) => {
      expect(() => scoreSchema.parse(score)).toThrow();
    },
  );

  it.each(CEFR_LEVELS)("accepts CEFR value %s", (cefr) => {
    expect(cefrLevelSchema.parse(cefr)).toBe(cefr);
  });

  it.each(["a1", "A3", "unknown", ""])("rejects CEFR value %s", (cefr) => {
    expect(cefrLevelSchema.safeParse(cefr).success).toBe(false);
  });
});

describe("confidence", () => {
  it.each([0, 0.5, 1])("accepts %s", (confidence) => {
    expect(assertConfidence(confidence)).toBe(confidence);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (confidence) => {
    expect(() => assertConfidence(confidence)).toThrow();
  });
});

describe("pedagogical skills", () => {
  it("defines exactly the seven skills", () => {
    expect(PEDAGOGICAL_SKILLS).toHaveLength(7);
    for (const skill of PEDAGOGICAL_SKILLS) expect(pedagogicalSkillSchema.parse(skill)).toBe(skill);
  });
});

function evidence(skill: PedagogicalSkill, score: number, overrides = {}): AssessmentEvidence {
  return {
    skill,
    sourceType: "quiz",
    rawScore: score,
    sourceReliability: 0.8,
    evidenceQuality: 0.9,
    sampleWeight: 1,
    evaluatedBy: "deterministic",
    rubricVersion: "rubric-v1",
    ...overrides,
  };
}

describe("skill aggregation", () => {
  it("does not confuse missing evidence with A1", () => {
    expect(aggregateSkillEvidence("reading", [])).toEqual({
      skill: "reading",
      score: null,
      cefr: "insufficient_evidence",
      confidence: null,
      evidenceCount: 0,
      ruleVersion: "cefr-score-v1",
    });
  });

  it("requires the configured minimum evidence", () => {
    const result = aggregateSkillEvidence("writing", [evidence("writing", 100)]);
    expect(result.cefr).toBe("insufficient_evidence");
    expect(result.score).toBeNull();
  });

  it("uses quality, reliability and sample weight in the score", () => {
    const result = aggregateSkillEvidence("grammar", [
      evidence("grammar", 100),
      evidence("grammar", 0, { evidenceQuality: 0.5 }),
    ]);
    expect(result.score).toBe(64);
    expect(result.cefr).toBe("B2");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("ignores evidence for a different skill and invalid evidence", () => {
    const result = aggregateSkillEvidence("listening", [
      evidence("speaking", 80),
      evidence("listening", 80, { evidenceQuality: 2 }),
    ]);
    expect(result.cefr).toBe("insufficient_evidence");
    expect(result.evidenceCount).toBe(0);
  });

  it("is deterministic and does not mutate prior results", () => {
    const first = aggregateSkillEvidence("vocabulary", [
      evidence("vocabulary", 40),
      evidence("vocabulary", 50),
    ]);
    const second = aggregateSkillEvidence("vocabulary", [
      evidence("vocabulary", 90),
      evidence("vocabulary", 100),
    ]);
    expect(first).toEqual(
      aggregateSkillEvidence("vocabulary", [
        evidence("vocabulary", 40),
        evidence("vocabulary", 50),
      ]),
    );
    expect(first).not.toEqual(second);
  });
});

describe("Quiz dual-write mapping", () => {
  const detail = {
    question_id: "11111111-1111-4111-8111-111111111111",
    question: "Choose the correct form",
    answer: "goes",
    correct_answer: "goes",
    is_correct: true,
  };

  it("preserves the source item and maps an explicitly classified correct answer", () => {
    expect(quizEvidence({ ...detail, pedagogical_skill: "grammar" })).toMatchObject({
      skill: "grammar",
      sourceItemId: detail.question_id,
      rawScore: 100,
      polarity: "positive",
    });
  });

  it("maps an explicitly classified incorrect vocabulary answer as negative", () => {
    expect(
      quizEvidence({ ...detail, is_correct: false, pedagogical_skill: "vocabulary" }),
    ).toMatchObject({ skill: "vocabulary", rawScore: 0, polarity: "negative" });
  });

  it("does not invent a skill while parsing unclassified operational details", () => {
    const [parsed] = parseQuizDetails([detail]);
    expect(parsed).toEqual(detail);
    expect(parsed).not.toHaveProperty("pedagogical_skill");
  });

  it("accepts legacy details without a question identifier without inventing one", () => {
    const { question_id: _questionId, ...legacy } = detail;
    expect(parseQuizDetails([legacy])).toEqual([legacy]);
  });
});

describe("Authoritative source contracts", () => {
  const questionId = "11111111-1111-4111-8111-111111111111";
  const operationKey = "33333333-3333-4333-8333-333333333333";

  it("calculates Quiz results exclusively from stored answer keys", () => {
    expect(
      gradeQuizAnswers(
        [
          {
            id: questionId,
            question: "Stored question",
            correct_answer: "server-key",
            sort_order: 1,
          },
        ],
        [{ questionId, answer: "forged-answer" }],
      ),
    ).toMatchObject({ score: 0, correct: 0, details: [{ is_correct: false }] });
  });

  it("rejects client-declared Quiz scores and correctness", () => {
    expect(
      authoritativeQuizInputSchema.safeParse({
        attemptKey: operationKey,
        lessonId: "22222222-2222-4222-8222-222222222222",
        answers: [{ questionId, answer: "server-key" }],
        score: 100,
        correct: 1,
        is_correct: true,
      }).success,
    ).toBe(false);
  });

  it("rejects client-declared Writing evaluation fields", () => {
    expect(
      authoritativeWritingInputSchema.safeParse({
        operationKey,
        prompt: "Describe your week.",
        originalText: "This is my original writing text.",
        level: "b1",
        grammar: 100,
        vocabulary: 100,
        clarity: 100,
        corrected: "Forged correction",
      }).success,
    ).toBe(false);
  });

  it("keeps retry identities valid while rejecting duplicate Quiz answers", () => {
    expect(() =>
      gradeQuizAnswers(
        [{ id: questionId, question: "Stored question", correct_answer: "yes", sort_order: 1 }],
        [
          { questionId, answer: "yes" },
          { questionId, answer: "yes" },
        ],
      ),
    ).toThrow("Duplicate quiz answer");
  });
});

describe("Writing dual-write mapping", () => {
  const scores = { grammar: 82, vocabulary: 74, clarity: 91 };

  it("preserves the three existing Gemini subscores", () => {
    expect(writingEvidence(scores)).toEqual([
      expect.objectContaining({ skill: "grammar", subskill: "writing_grammar", rawScore: 82 }),
      expect.objectContaining({
        skill: "vocabulary",
        subskill: "writing_vocabulary",
        rawScore: 74,
      }),
      expect.objectContaining({ skill: "writing", subskill: "clarity", rawScore: 91 }),
    ]);
  });

  it("keeps clarity as a writing subskill rather than inventing an eighth skill", () => {
    const clarity = writingEvidence(scores).find((item) => item.subskill === "clarity");
    expect(clarity?.skill).toBe("writing");
    expect(PEDAGOGICAL_SKILLS).toHaveLength(7);
  });

  it("preserves original text and the complete existing evaluation in its source record", () => {
    const record = writingSubmissionRecord({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "writing:33333333-3333-4333-8333-333333333333",
      prompt: "Describe your week.",
      originalText: "My untouched original text.",
      feedback: {
        ...scores,
        corrected: "My corrected text.",
        natural: "My more natural text.",
        explanations: ["Existing explanation"],
        suggestions: ["Existing suggestion"],
      },
    });
    expect(record.original_text).toBe("My untouched original text.");
    expect(record).toMatchObject({
      corrected_text: "My corrected text.",
      natural_text: "My more natural text.",
      explanations: ["Existing explanation"],
      suggestions: ["Existing suggestion"],
      grammar_score: 82,
      vocabulary_score: 74,
      clarity_score: 91,
    });
  });
});

describe("Dual-write resilience", () => {
  it("absorbs pedagogical failures without failing the operational caller", async () => {
    await expect(
      toleratePedagogicalFailure(async () => {
        throw new Error("pedagogy unavailable");
      }),
    ).resolves.toBeNull();
  });

  it("returns a successful pedagogical result unchanged", async () => {
    await expect(toleratePedagogicalFailure(async () => "saved")).resolves.toBe("saved");
  });
});

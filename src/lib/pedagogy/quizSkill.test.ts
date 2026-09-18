import { describe, expect, it } from "vitest";

import { QUIZ_EVIDENCE_SKILLS, resolveQuizEvidenceSkill } from "./quizSkill";

describe("resolveQuizEvidenceSkill", () => {
  it("accepts only the skills the evidence pipeline supports", () => {
    expect(QUIZ_EVIDENCE_SKILLS).toEqual(["grammar", "vocabulary"]);
    expect(resolveQuizEvidenceSkill("grammar")).toBe("grammar");
    expect(resolveQuizEvidenceSkill(" Vocabulary ")).toBe("vocabulary");
  });

  it("never invents a skill for unsupported or missing labels", () => {
    expect(resolveQuizEvidenceSkill("reading")).toBeNull();
    expect(resolveQuizEvidenceSkill("listening")).toBeNull();
    expect(resolveQuizEvidenceSkill(undefined)).toBeNull();
    expect(resolveQuizEvidenceSkill(null)).toBeNull();
    expect(resolveQuizEvidenceSkill(42)).toBeNull();
  });

  it("uses the structural default only when the flow constrains the skill", () => {
    expect(resolveQuizEvidenceSkill(undefined, "grammar")).toBe("grammar");
    expect(resolveQuizEvidenceSkill("nonsense", "grammar")).toBe("grammar");
    expect(resolveQuizEvidenceSkill(undefined, null)).toBeNull();
  });

  it("prefers a valid explicit label over the structural default", () => {
    expect(resolveQuizEvidenceSkill("vocabulary", "grammar")).toBe("vocabulary");
  });
});

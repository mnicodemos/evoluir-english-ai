import { describe, expect, it } from "vitest";

import {
  coachBlock,
  coachFocus,
  coachStage,
  coachStudentTurns,
  COACH_MAX_TURNS,
} from "./coachSession";
import type { TeacherContextForPrompt } from "./teacherPrompt";

const base: TeacherContextForPrompt = {
  cefrLevel: "B1",
  skills: [],
  recurringErrors: [],
};

describe("coach session stages", () => {
  it("walks start -> feedback -> retry -> summary", () => {
    expect(coachStage(1)).toBe("START");
    expect(coachStage(2)).toBe("FEEDBACK");
    expect(coachStage(3)).toBe("RETRY");
    expect(coachStage(COACH_MAX_TURNS)).toBe("SUMMARY");
  });

  it("counts the current student turn from the history", () => {
    expect(coachStudentTurns([])).toBe(1);
    expect(
      coachStudentTurns([
        { role: "user" },
        { role: "assistant" },
        { role: "user" },
        { role: "assistant" },
      ]),
    ).toBe(3);
  });
});

describe("coach focus", () => {
  it("falls back to general practice for a new student", () => {
    const focus = coachFocus(base);
    expect(focus.skill).toBeNull();
    expect(focus.reason).toBe("no_data");
    expect(coachBlock(focus, "START", 1)).toContain("general practice");
  });

  it("uses the existing priority skill when evidence exists", () => {
    const focus = coachFocus({
      ...base,
      skills: [
        { skill: "grammar", score: 80, confidence: 0.8, cefrLevel: "B1" },
        { skill: "writing", score: 55, confidence: 0.8, cefrLevel: "B1" },
      ],
    });
    expect(focus.skill).toBe("writing");
  });

  it("prioritises a recent recurring error", () => {
    const focus = coachFocus({
      ...base,
      skills: [
        { skill: "grammar", score: 90, confidence: 0.9, cefrLevel: "B1" },
        { skill: "writing", score: 55, confidence: 0.9, cefrLevel: "B1" },
      ],
      recurringErrors: ["grammar: wrong use of present perfect"],
    });
    expect(focus.skill).toBe("grammar");
    expect(focus.reason).toBe("recent_errors");
  });

  it("keeps the CEFR level from the server context and never invents one", () => {
    const focus = coachFocus({ ...base, cefrLevel: null });
    expect(focus.cefrLevel).toBeNull();
    expect(coachBlock(focus, "CHALLENGE", 2)).toContain("level is unknown");
  });

  it("closes the session with a summary block", () => {
    const block = coachBlock(coachFocus(base), "SUMMARY", COACH_MAX_TURNS);
    expect(block).toContain("Close the session");
  });
});

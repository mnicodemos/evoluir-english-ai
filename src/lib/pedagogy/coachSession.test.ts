import { describe, expect, it } from "vitest";

import {
  coachBlock,
  coachFocus,
  coachPlan,
  coachPlannedTurns,
  coachScenario,
  coachStage,
  coachStudentTurns,
  coachTier,
  productionSignal,
  COACH_MAX_TURNS,
  COACH_MIN_TURNS,
} from "./coachSession";
import type { TeacherContextForPrompt } from "./teacherPrompt";

const base: TeacherContextForPrompt = {
  cefrLevel: "B1",
  skills: [],
  recurringErrors: [],
};

const strong =
  "In the last meeting I explained our delay because the supplier changed the deadline. I suggested a new plan, although the client was not happy about it.";
const weak = "I go meeting.";

function plan(history: { role: "user" | "assistant"; content: string }[], message: string) {
  return coachPlan(base, history, message);
}

describe("coach session stages", () => {
  it("walks start -> feedback -> retry -> adapt and closes at the planned turn", () => {
    expect(coachStage(1, 8)).toBe("START");
    expect(coachStage(2, 8)).toBe("FEEDBACK");
    expect(coachStage(3, 8)).toBe("RETRY");
    expect(coachStage(4, 8)).toBe("ADAPT");
    expect(coachStage(5, 8)).toBe("FEEDBACK");
    expect(coachStage(8, 8)).toBe("SUMMARY");
  });

  it("keeps the session length inside the 5-10 window", () => {
    expect(coachStage(5, 2)).toBe("SUMMARY");
    expect(coachStage(COACH_MAX_TURNS, 99)).toBe("SUMMARY");
    expect(coachPlannedTurns("EASY")).toBeGreaterThanOrEqual(COACH_MIN_TURNS);
    expect(coachPlannedTurns("CHALLENGE")).toBeLessThanOrEqual(COACH_MAX_TURNS);
  });

  it("counts only the student's own turns", () => {
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
    expect(coachBlock(plan([], "Start a guided study session with me."))).toContain(
      "general practice",
    );
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
    expect(focus.score).toBe(55);
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

  it("prioritises a skill that was never measured", () => {
    const focus = coachFocus({
      ...base,
      skills: [
        { skill: "grammar", score: 70, confidence: 0.8, cefrLevel: "B1" },
        { skill: "listening", score: null, confidence: null, cefrLevel: "B1" },
      ],
    });
    expect(focus.skill).toBe("listening");
  });

  it("keeps the CEFR level from the server context and never invents one", () => {
    const block = coachBlock(coachPlan({ ...base, cefrLevel: null }, [], "hello"));
    expect(block).toContain("level is unknown");
  });
});

describe("session difficulty adaptation", () => {
  it("scores real production above one-word answers", () => {
    expect(productionSignal(strong)).toBeGreaterThan(productionSignal(weak));
    expect(productionSignal("")).toBe(0);
  });

  it("raises the challenge when the student produces well", () => {
    expect(coachTier({ productions: [strong, strong], focusScore: 75 })).toBe("CHALLENGE");
  });

  it("lowers the load when the student struggles", () => {
    expect(coachTier({ productions: [weak, weak], focusScore: 40 })).toBe("EASY");
  });

  it("starts from standard with no production yet", () => {
    expect(coachTier({ productions: [] })).toBe("STANDARD");
    expect(plan([], "Start a guided study session with me.").tier).toBe("STANDARD");
  });

  it("asks for support and a new attempt at the easy tier", () => {
    const block = coachBlock(
      coachPlan(
        base,
        [
          { role: "user", content: "Start a session" },
          { role: "assistant", content: "..." },
        ],
        weak,
      ),
    );
    expect(block).toContain("hint");
    expect(block).toContain("FEEDBACK PRIORITY");
  });

  it("keeps the internal tier out of the student's view", () => {
    const block = coachBlock(plan([], "Start"));
    expect(block).toContain("Never reveal or mention the internal difficulty");
  });
});

describe("feedback, retry and follow-up rules", () => {
  it("asks for a new production right after a correction", () => {
    const block = coachBlock(
      coachPlan(
        base,
        [
          { role: "user", content: "Start" },
          { role: "assistant", content: "..." },
        ],
        strong,
      ),
    );
    expect(block).toContain("use the corrected structure again");
  });

  it("asks a spontaneous follow-up on the retry stage", () => {
    expect(coachStage(3, 8)).toBe("RETRY");
    const history = [
      { role: "user" as const, content: "Start" },
      { role: "assistant" as const, content: "..." },
      { role: "user" as const, content: strong },
      { role: "assistant" as const, content: "..." },
    ];
    const block = coachBlock(coachPlan(base, history, strong));
    expect(block).toContain("follow-up");
  });

  it("closes with a pedagogical summary and no metrics", () => {
    const history = Array.from({ length: 5 }, (_, index) => index).flatMap(() => [
      { role: "user" as const, content: weak },
      { role: "assistant" as const, content: "..." },
    ]);
    const closing = coachPlan(base, history, weak);
    expect(closing.finished).toBe(true);
    const block = coachBlock(closing);
    expect(block).toContain("Close the session");
    expect(block).toContain("no numbers");
  });
});

describe("context variation", () => {
  it("varies the situation across rounds and respects the level", () => {
    const first = coachScenario("B1", 0);
    const second = coachScenario("B1", 1);
    expect(first).not.toBe(second);
    expect(coachScenario("A1", 0)).not.toBe(coachScenario("C1", 0));
  });

  it("always keeps the student inside a real situation", () => {
    expect(coachBlock(plan([], "Start"))).toContain("Situation for this part of the session");
  });
});

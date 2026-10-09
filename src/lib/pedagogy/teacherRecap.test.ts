import { describe, expect, it } from "vitest";

import { isTeacherRecapTurn, teacherMistakeInMessage } from "./teacherRecap";

const turns = (n: number) =>
  Array.from({ length: n * 2 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant" }) as const);

describe("AI Teacher recap and mistakes", () => {
  it("recaps on the 6th and 12th student message", () => {
    expect(isTeacherRecapTurn(turns(4))).toBe(false);
    expect(isTeacherRecapTurn(turns(5))).toBe(true);
    expect(isTeacherRecapTurn(turns(11))).toBe(true);
    expect(isTeacherRecapTurn([])).toBe(false);
  });

  it("keeps only mistakes copied from the student's message", () => {
    const mistake = {
      original: "I go  to the beach yesterday",
      corrected: "I went to the beach yesterday",
      explanation: "",
      category: "grammar",
    };
    expect(teacherMistakeInMessage(mistake, "Hi! I go to the beach yesterday.")).toBe(mistake);
    expect(teacherMistakeInMessage(mistake, "I went to the beach")).toBeNull();
    expect(
      teacherMistakeInMessage(
        { ...mistake, corrected: "I go to the beach yesterday" },
        mistake.original,
      ),
    ).toBeNull();
    expect(teacherMistakeInMessage(null, "anything")).toBeNull();
  });
});

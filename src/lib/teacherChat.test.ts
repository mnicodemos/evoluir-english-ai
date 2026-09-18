import { describe, expect, it } from "vitest";

import {
  buildTeacherHistory,
  parseStoredMessages,
  teacherErrorMessage,
  validateTeacherMessage,
  TEACHER_HISTORY_MAX,
} from "./teacherChat";

describe("teacher chat helpers", () => {
  it("rejects empty messages and accepts normal ones", () => {
    expect(validateTeacherMessage("   ").ok).toBe(false);
    expect(validateTeacherMessage("  I have lived here for five years. ")).toEqual({
      ok: true,
      value: "I have lived here for five years.",
    });
  });

  it("rejects messages above the backend limit", () => {
    expect(validateTeacherMessage("a".repeat(2001)).ok).toBe(false);
  });

  it("keeps only the recent turns the backend accepts", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `m${i}`,
    }));
    const history = buildTeacherHistory(messages);
    expect(history).toHaveLength(TEACHER_HISTORY_MAX);
    expect(history.at(-1)?.content).toBe("m29");
  });

  it("maps backend failures to friendly categories without leaking details", () => {
    expect(teacherErrorMessage(new Error("AiError: 429 quota exceeded"))).toBe("quota");
    expect(teacherErrorMessage(new Error("Unauthorized: No authorization header"))).toBe("auth");
    expect(teacherErrorMessage(new Error("failed to fetch"))).toBe("network");
    expect(teacherErrorMessage(new Error("select * from ai_conversations failed"))).toBe("unknown");
  });

  it("ignores malformed stored conversation rows", () => {
    expect(
      parseStoredMessages([
        { role: "user", content: "hi" },
        { role: "system", content: "secret" },
        { role: "assistant", content: "" },
        null,
        "nope",
        { role: "assistant", content: "hello" },
      ]),
    ).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    expect(parseStoredMessages(null)).toEqual([]);
  });
});

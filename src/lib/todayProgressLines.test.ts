import { describe, expect, it } from "vitest";

import { todayProgressLines } from "./todayProgressLines";

const empty = { lessonsCompleted: 0, wordsMastered: 0, accuracy: 0, activities: [] };

describe("today's progress lines", () => {
  it("keeps lessons, words and accuracy when nothing happened today", () => {
    expect(todayProgressLines(empty).map((line) => [line.key, line.state])).toEqual([
      ["lessons", "empty"],
      ["words", "empty"],
      ["accuracy", "empty"],
    ]);
  });

  it("shows the activities that filled the ring, not empty lesson lines", () => {
    const lines = todayProgressLines({
      ...empty,
      activities: [
        { activity_type: "conversation", duration_minutes: 12 },
        { activity_type: "teacher", duration_minutes: 8 },
      ],
    });
    expect(lines.map((line) => line.key)).toEqual(["conversations", "teacher", "lessons"]);
    expect(lines[0]).toMatchObject({ value: "1", label: "Conversation with EVO", state: "done" });
    expect(lines[1]).toMatchObject({ value: "8", state: "done" });
  });

  it("keeps the three most important activities of a busy day", () => {
    const lines = todayProgressLines({
      lessonsCompleted: 1,
      wordsMastered: 10,
      accuracy: 43,
      activities: [
        { activity_type: "writing", duration_minutes: 5 },
        { activity_type: "writing", duration_minutes: 5 },
        { activity_type: "listening", duration_minutes: 4 },
      ],
    });
    expect(lines.map((line) => [line.key, line.value])).toEqual([
      ["lessons", "1"],
      ["writing", "2"],
      ["listening", "1"],
    ]);
  });

  it("marks a low accuracy as needing attention", () => {
    const accuracy = todayProgressLines({ ...empty, accuracy: 43 }).find(
      (line) => line.key === "accuracy",
    );
    expect(accuracy?.state).toBe("attention");
  });

  it("counts lesson-page time only while no lesson was finished", () => {
    const rows = [{ activity_type: "lesson_practice", duration_minutes: 6 }];
    expect(
      todayProgressLines({ ...empty, activities: rows }).some((l) => l.key === "lesson-time"),
    ).toBe(true);
    expect(
      todayProgressLines({ ...empty, lessonsCompleted: 1, activities: rows }).some(
        (l) => l.key === "lesson-time",
      ),
    ).toBe(false);
  });
});

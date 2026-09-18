import { describe, expect, it } from "vitest";

import {
  expectedLengthLabel,
  pickWritingTasks,
  WRITING_CATEGORIES,
  writingLevelConfig,
} from "@/lib/writingLevels";

describe("writing level configuration", () => {
  it("adapts the expected length to the CEFR level", () => {
    expect(expectedLengthLabel(writingLevelConfig("a1"))).toBe("30–50 words");
    expect(expectedLengthLabel(writingLevelConfig("a2"))).toBe("50–80 words");
    expect(expectedLengthLabel(writingLevelConfig("b1"))).toBe("100–150 words");
    expect(expectedLengthLabel(writingLevelConfig("b2"))).toBe("150–220 words");
    expect(expectedLengthLabel(writingLevelConfig("c1"))).toBe("220–300 words");
    expect(expectedLengthLabel(writingLevelConfig("c2"))).toBe("300+ words");
  });

  it("keeps the existing B2 tasks and maps legacy level names", () => {
    const b2 = writingLevelConfig("upper-intermediate");
    expect(b2.level).toBe("b2");
    expect(b2.tasks.professional).toContain("Write an email asking a client to reschedule a meeting.");
  });

  it("offers one task per theme for the level", () => {
    const config = writingLevelConfig("a1");
    const tasks = pickWritingTasks({ config });
    expect(tasks).toHaveLength(WRITING_CATEGORIES.length);
    for (const [index, task] of tasks.entries()) {
      const category = WRITING_CATEGORIES[index]!.id;
      expect(config.tasks[category]).toContain(task);
    }
  });

  it("skips tasks the student already answered", () => {
    const config = writingLevelConfig("b1");
    const firstEveryday = config.tasks.everyday[0]!;
    const tasks = pickWritingTasks({ config, history: [firstEveryday] });
    expect(tasks).not.toContain(firstEveryday);
  });

  it("rotates the tasks as new lessons are started", () => {
    const config = writingLevelConfig("c1");
    expect(pickWritingTasks({ config, rotation: 0 })).not.toEqual(
      pickWritingTasks({ config, rotation: 1 }),
    );
  });

  it("carries level priorities for the correction context", () => {
    expect(writingLevelConfig("a1").priorities[0]).toContain("understandability");
    expect(writingLevelConfig("c2").priorities[0]).toContain("nuance");
  });
});

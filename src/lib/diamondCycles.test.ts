import { describe, expect, it } from "vitest";

import { daysToNextDiamond, diamondLevel, diamondName, diamondShareText } from "./diamondCycles";

describe("diamond cycles", () => {
  it("is the plain Diamond until a cycle is stored", () => {
    expect(diamondLevel([])).toBe(1);
    expect(diamondLevel([2, 3])).toBe(3);
    expect(diamondName(1, "pt")).toBe("Diamante");
    expect(diamondName(3, "en")).toBe("Diamond ×3");
  });

  it("counts the days in a row still needed for the next cycle", () => {
    expect(daysToNextDiamond(1, 63)).toBe(63);
    expect(daysToNextDiamond(1, 120)).toBe(6);
    expect(daysToNextDiamond(2, 10)).toBe(179);
    expect(daysToNextDiamond(1, 200)).toBe(0);
  });

  it("shares only the achievement, skipping unknown numbers", () => {
    const text = diamondShareText(
      {
        level: 2,
        streakDays: 126,
        studyDays: 140,
        conversations: 0,
        wordsLearned: 300,
        englishLevel: "b1",
      },
      "pt",
    );
    expect(text).toContain("Diamante ×2");
    expect(text).toContain("126 dias seguidos");
    expect(text).toContain("300 palavras");
    expect(text).toContain("Nível B1");
    expect(text).not.toContain("conversas");
  });
});

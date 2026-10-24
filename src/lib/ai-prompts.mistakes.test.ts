import { describe, expect, it } from "vitest";

import { parseWritingFeedback } from "./ai-prompts";

const base = {
  corrected: "I went to school.",
  natural: "I went to school.",
  explanations: ["Past tense of go is went."],
  suggestions: [],
  grammar: 70,
  vocabulary: 80,
  clarity: 90,
};

describe("parseWritingFeedback mistakes", () => {
  it("keeps valid mistakes and drops broken or unchanged ones", () => {
    const feedback = parseWritingFeedback(
      JSON.stringify({
        ...base,
        mistakes: [
          {
            original: "I goed",
            corrected: "I went",
            explanation: "Irregular verb",
            category: "verb",
          },
          { original: "school", corrected: "school" },
          { corrected: "missing original" },
          "not an object",
        ],
      }),
      "I goed to school.",
    );
    expect(feedback.mistakes).toEqual([
      { original: "I goed", corrected: "I went", explanation: "Irregular verb", category: "verb" },
    ]);
  });

  it("caps the list at five without rejecting a long reply", () => {
    const mistakes = Array.from({ length: 12 }, (_, i) => ({
      original: `wrong ${i}`,
      corrected: `right ${i}`,
    }));
    const feedback = parseWritingFeedback(JSON.stringify({ ...base, mistakes }), "text");
    expect(feedback.mistakes).toHaveLength(5);
    expect(feedback.mistakes?.[0]?.category).toBe("grammar");
  });

  it("still accepts feedback without mistakes", () => {
    expect(parseWritingFeedback(JSON.stringify(base), "text").mistakes).toEqual([]);
  });

  it("keeps an off-format correction usable (fast mode)", () => {
    const feedback = parseWritingFeedback(
      `Sure! ${JSON.stringify({
        corrected: "I went to school.",
        explanations: ["Past simple.", ""],
        suggestions: [],
        grammar: "80",
        vocabulary: 140,
        clarity: 70,
        extra: true,
      })}`,
      "I go to school.",
    );
    expect(feedback).toMatchObject({
      corrected: "I went to school.",
      natural: "I went to school.",
      explanations: ["Past simple."],
      grammar: 80,
      vocabulary: 100,
      clarity: 70,
    });
  });
});

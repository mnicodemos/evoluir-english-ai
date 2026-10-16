import { describe, expect, it } from "vitest";

import { mistakeTypeOf } from "./mistakeType";

describe("mistakeTypeOf", () => {
  it("folds the AI's free categories into the fixed tabs", () => {
    expect(mistakeTypeOf("grammar")).toBe("grammar");
    expect(mistakeTypeOf("Verb tense")).toBe("grammar");
    expect(mistakeTypeOf("vocabulary")).toBe("vocabulary");
    expect(mistakeTypeOf("Word choice")).toBe("vocabulary");
    expect(mistakeTypeOf("spelling")).toBe("spelling");
    expect(mistakeTypeOf("punctuation")).toBe("punctuation");
    expect(mistakeTypeOf("word order")).toBe("word order");
    expect(mistakeTypeOf("style")).toBe("other");
  });

  it("treats a missing category as grammar, the saved default", () => {
    expect(mistakeTypeOf("")).toBe("grammar");
    expect(mistakeTypeOf(null)).toBe("grammar");
  });
});

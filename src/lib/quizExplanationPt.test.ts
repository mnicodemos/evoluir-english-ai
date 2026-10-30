import { describe, expect, it } from "vitest";

import { parseExplanationsPt, showsExplanationPt } from "./quizExplanationPt";

describe("quiz explanations in Portuguese", () => {
  it("shows them at once only at A1-A2", () => {
    expect(showsExplanationPt("A1")).toBe(true);
    expect(showsExplanationPt("A2")).toBe(true);
    expect(showsExplanationPt("B1")).toBe(false);
    expect(showsExplanationPt(null)).toBe(false);
  });

  it("keeps one line per explanation, in order", () => {
    expect(parseExplanationsPt('{"pt":["Um.","Dois."]}', 2)).toEqual(["Um.", "Dois."]);
  });

  it("never shifts lines when one is missing or not text", () => {
    expect(parseExplanationsPt('ok {"pt":["Um.", 3]} done', 3)).toEqual(["Um.", "", ""]);
  });

  it("returns empty lines for an unreadable answer", () => {
    expect(parseExplanationsPt("sorry", 2)).toEqual(["", ""]);
  });
});

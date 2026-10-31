import { describe, expect, it } from "vitest";

import { foldText, searchLessons } from "./lessonSearch";

const lessons = [
  { key: "a", title: "Past Simple: Regular Verbs", unitTitle: "My Weekend" },
  { key: "b", title: "Ordering at a Café", unitTitle: "Food and Drink" },
  { key: "c", title: "Talking about Plans", unitTitle: "The Future" },
];

describe("lesson search", () => {
  it("ignores case and accents", () => {
    expect(foldText("Lição CAFÉ")).toBe("licao cafe");
    expect(searchLessons(lessons, "PAST").map((l) => l.key)).toEqual(["a"]);
    expect(searchLessons(lessons, "cafe").map((l) => l.key)).toEqual(["b"]);
  });

  it("matches the unit title too and keeps path order", () => {
    expect(searchLessons(lessons, "future").map((l) => l.key)).toEqual(["c"]);
    expect(searchLessons(lessons, "ing").map((l) => l.key)).toEqual(["b", "c"]);
  });

  it("finds nothing for an empty query or an unknown word", () => {
    expect(searchLessons(lessons, "   ")).toEqual([]);
    expect(searchLessons(lessons, "zzqqxx")).toEqual([]);
  });
});

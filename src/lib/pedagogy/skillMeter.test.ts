import { describe, expect, it } from "vitest";

import { skillMeterRows } from "./skillMeter";

describe("skill meter", () => {
  it("shows the four card skills in order, unmeasured when there is no evidence", () => {
    const rows = skillMeterRows([], null);
    expect(rows.map((row) => row.skill)).toEqual(["listening", "speaking", "writing", "grammar"]);
    expect(rows.every((row) => row.value === null && row.status === "not_measured")).toBe(true);
  });

  it("treats insufficient evidence as not measured, not as a low score", () => {
    const [listening] = skillMeterRows(
      [{ skill: "listening", score: 40, cefrLevel: "insufficient_evidence", evidenceCount: 1 }],
      null,
    );
    expect(listening).toMatchObject({ value: null, status: "not_measured", evidenceCount: 1 });
  });

  it("labels measured skills by score and keeps Priority only for EVO's choice", () => {
    const rows = skillMeterRows(
      [
        { skill: "listening", score: 91.4, cefrLevel: "B2", evidenceCount: 12 },
        { skill: "speaking", score: 58, cefrLevel: "B1", evidenceCount: 3 },
        { skill: "writing", score: 70, cefrLevel: "B2", evidenceCount: 4 },
        { skill: "grammar", score: 40, cefrLevel: "A2", evidenceCount: 6 },
      ],
      "speaking",
    );
    expect(rows.map((row) => [row.skill, row.value, row.status])).toEqual([
      ["listening", 91, "strong"],
      ["speaking", 58, "priority"],
      ["writing", 70, "on_track"],
      ["grammar", 40, "needs_work"],
    ]);
  });

  it("marks the priority skill even before it is measured", () => {
    const rows = skillMeterRows([], "writing");
    expect(rows.find((row) => row.skill === "writing")).toMatchObject({
      value: null,
      status: "priority",
    });
  });
});

describe("skillMeterRows after a level change", () => {
  it("keeps the last score but tags the level it came from", () => {
    const rows = skillMeterRows(
      [
        { skill: "listening", score: 82, cefrLevel: "b2", evidenceCount: 6 },
        { skill: "writing", score: 81, cefrLevel: "c1", evidenceCount: 3 },
        { skill: "speaking", score: 45, cefrLevel: "b2", evidenceCount: 2 },
      ],
      "listening",
      undefined,
      "c1",
    );
    const [listening, speaking, writing] = rows;
    // EVO's priority is decided at C1, where listening has no evidence yet.
    expect(listening).toMatchObject({ value: 82, status: "priority", otherLevel: "B2" });
    expect(speaking).toMatchObject({ value: 45, status: "other_level", otherLevel: "B2" });
    expect(writing).toMatchObject({ value: 81, status: "on_track", otherLevel: null });
  });
});

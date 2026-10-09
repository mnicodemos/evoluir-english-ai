import { describe, expect, it } from "vitest";

import { studyDayStartIso, studyToday, studyWeekday } from "./today";

describe("study day (America/Sao_Paulo)", () => {
  it("keeps the previous day until midnight in São Paulo, not UTC", () => {
    // 23:30 in São Paulo is already the next day in UTC.
    const lateEvening = new Date("2026-10-06T02:30:00Z");
    expect(studyToday(lateEvening)).toBe("2026-10-05");
  });

  it("starts the study day at 03:00 UTC", () => {
    expect(studyDayStartIso(new Date("2026-10-06T02:30:00Z"))).toBe("2026-10-05T03:00:00.000Z");
    expect(studyDayStartIso(new Date("2026-10-06T03:00:00Z"))).toBe("2026-10-06T03:00:00.000Z");
  });
});

describe("studyWeekday", () => {
  it("names the São Paulo weekday in the student's language", () => {
    // 02:00 UTC on Saturday is still Friday evening in São Paulo.
    const at = new Date("2026-10-10T02:00:00Z");
    expect(studyWeekday("en", at)).toBe("Friday");
    expect(studyWeekday("pt", at)).toBe("Sexta-feira");
  });
});

import { describe, expect, it } from "vitest";

import { countQualifiedListeningParts, leagueWeekStartIso } from "@/lib/languageArenaProof";

describe("Language Arena proof mission", () => {
  it("counts only saved scores at or above 70 and caps progress at the goal", () => {
    expect(countQualifiedListeningParts([null, 69, 70, 82, 100])).toBe(3);
    expect(countQualifiedListeningParts([null, 69])).toBe(0);
    expect(countQualifiedListeningParts([70, 70])).toBe(2);
  });

  it("uses Monday 00:00 in America/Sao_Paulo as the week boundary", () => {
    // Monday 00:00 in São Paulo is 03:00 UTC.
    expect(leagueWeekStartIso(new Date("2026-10-26T02:59:59.000Z"))).toBe(
      "2026-10-19T03:00:00.000Z",
    );
    expect(leagueWeekStartIso(new Date("2026-10-26T03:00:00.000Z"))).toBe(
      "2026-10-26T03:00:00.000Z",
    );
    expect(leagueWeekStartIso(new Date("2026-10-28T12:00:00.000Z"))).toBe(
      "2026-10-26T03:00:00.000Z",
    );
  });
});

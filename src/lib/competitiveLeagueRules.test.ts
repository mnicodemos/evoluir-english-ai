import { describe, expect, it } from "vitest";

import {
  COMPETITIVE_LEAGUES,
  leagueMovement,
  rankLeagueParticipants,
} from "@/lib/competitiveLeagueRules";

describe("competitive league rules", () => {
  it("defines the ten divisions in progression order", () => {
    expect(COMPETITIVE_LEAGUES).toEqual([
      "Bronze",
      "Silver",
      "Gold",
      "Sapphire",
      "Ruby",
      "Emerald",
      "Amethyst",
      "Pearl",
      "Obsidian",
      "Diamond",
    ]);
  });

  it("ranks equal XP deterministically by immutable ID", () => {
    expect(
      rankLeagueParticipants([
        { id: "user-c", xp: 100 },
        { id: "user-a", xp: 100 },
        { id: "user-b", xp: 120 },
      ]),
    ).toEqual([
      { id: "user-b", xp: 120, rank: 1 },
      { id: "user-a", xp: 100, rank: 2 },
      { id: "user-c", xp: 100, rank: 3 },
    ]);
  });

  it("uses rank-only for groups with fewer than ten participants", () => {
    expect(leagueMovement("Silver", 1, 9)).toBe("rank-only");
    expect(leagueMovement("Silver", 9, 9)).toBe("rank-only");
  });

  it("promotes the top four and demotes the bottom three in a full group", () => {
    expect([1, 2, 3, 4].map((rank) => leagueMovement("Silver", rank, 20))).toEqual([
      "promote",
      "promote",
      "promote",
      "promote",
    ]);
    expect([5, 17].map((rank) => leagueMovement("Silver", rank, 20))).toEqual(["stay", "stay"]);
    expect([18, 19, 20].map((rank) => leagueMovement("Silver", rank, 20))).toEqual([
      "demote",
      "demote",
      "demote",
    ]);
  });

  it("does not demote Bronze and awards Diamond elite status instead of promotion", () => {
    expect(leagueMovement("Bronze", 20, 20)).toBe("stay");
    expect(leagueMovement("Diamond", 1, 20)).toBe("elite-achievement");
  });

  it("supports groups of 10–19 without inventing nonexistent ranks", () => {
    expect(leagueMovement("Gold", 4, 12)).toBe("promote");
    expect(leagueMovement("Gold", 9, 12)).toBe("stay");
    expect(leagueMovement("Gold", 10, 12)).toBe("demote");
  });
});

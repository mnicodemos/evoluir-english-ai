export const COMPETITIVE_LEAGUES = [
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
] as const;

export type CompetitiveLeague = (typeof COMPETITIVE_LEAGUES)[number];
export type LeagueMovement = "promote" | "stay" | "demote" | "rank-only" | "elite-achievement";

export type LeagueParticipant = {
  id: string;
  xp: number;
};

/** Stable ranking: XP descending, then immutable user ID ascending. */
export function rankLeagueParticipants<T extends LeagueParticipant>(participants: T[]): Array<T & { rank: number }> {
  return [...participants]
    .sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id))
    .map((participant, index) => ({ ...participant, rank: index + 1 }));
}

/**
 * Movement is only evaluated for groups of at least 10 participants.
 * Top 4 promote, bottom 3 demote, and the middle stays. Bronze cannot
 * demote; Diamond awards an elite achievement rather than another promotion.
 */
export function leagueMovement(
  league: CompetitiveLeague,
  rank: number,
  members: number,
): LeagueMovement {
  if (!Number.isInteger(members) || members < 10 || !Number.isInteger(rank) || rank < 1 || rank > members) {
    return "rank-only";
  }

  if (rank <= 4) {
    return league === "Diamond" ? "elite-achievement" : "promote";
  }

  if (rank > members - 3) {
    return league === "Bronze" ? "stay" : "demote";
  }

  return "stay";
}

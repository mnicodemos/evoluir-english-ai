export const ENGLISH_ADVENTURES_TOTAL = 40;

const storageKey = (userId: string) => `evoluir-english-adventures:${userId}`;

export function completedAdventureIds(ids: string[], adventureId: string): string[] {
  return ids.includes(adventureId) ? ids : [...ids, adventureId];
}

export function englishAdventureProgress(ids: string[]) {
  const completed = Math.min(new Set(ids).size, ENGLISH_ADVENTURES_TOTAL);
  return {
    completed,
    total: ENGLISH_ADVENTURES_TOTAL,
    percent: Math.round((completed / ENGLISH_ADVENTURES_TOTAL) * 100),
  };
}

export function readCompletedAdventures(userId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === "string"))]
      : [];
  } catch {
    return [];
  }
}

export function saveCompletedAdventure(userId: string, adventureId: string): string[] {
  const next = completedAdventureIds(readCompletedAdventures(userId), adventureId);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // The current session still shows the completion when storage is unavailable.
  }
  return next;
}

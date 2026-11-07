export const ENGLISH_ADVENTURES_TOTAL = 40;

const storageKey = (userId: string) => `evoluir-english-adventures:${userId}`;
const activityKey = (userId: string) => `${storageKey(userId)}:activities`;
const secondsKey = (userId: string) => `${storageKey(userId)}:seconds`;

const legacyActivityIds: Record<string, number> = {
  "a1-welcome-mix-up": 10,
  "a1-neighbourhood-mystery": 10,
  "a2-surprise-delivery": 5,
  "a2-community-festival": 10,
};

export function completedAdventureIds(ids: string[], adventureId: string): string[] {
  return ids.includes(adventureId) ? ids : [...ids, adventureId];
}

export function readCompletedActivities(userId: string): string[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(activityKey(userId)) ?? "[]");
    const activityIds = Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === "string")
      : [];
    const legacyIds = readCompletedAdventures(userId);
    const expanded = legacyIds.flatMap((id) =>
      Array.from({ length: legacyActivityIds[id] ?? 0 }, (_, index) => `${id}:${index}`),
    );
    return [...new Set([...expanded, ...activityIds])];
  } catch {
    return [];
  }
}

export function markActivityComplete(userId: string, activityId: string): string[] {
  const next = [...new Set([...readCompletedActivities(userId), activityId])];
  try {
    window.localStorage.setItem(activityKey(userId), JSON.stringify(next));
  } catch {
    // Keep the current session progress even when storage is unavailable.
  }
  return next;
}

export function readStudySeconds(userId: string): number {
  try {
    const value = Number(window.localStorage.getItem(secondsKey(userId)) ?? 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function addStudySeconds(userId: string, seconds: number): number {
  const next = readStudySeconds(userId) + Math.max(0, Math.floor(seconds));
  try {
    window.localStorage.setItem(secondsKey(userId), String(next));
  } catch {
    // Keep the current session time even when storage is unavailable.
  }
  return next;
}

export function englishAdventureProgress(ids: string[], seconds = 0) {
  const completed = Math.min(new Set(ids).size, ENGLISH_ADVENTURES_TOTAL);
  return {
    completed,
    total: ENGLISH_ADVENTURES_TOTAL,
    percent: Math.round((completed / ENGLISH_ADVENTURES_TOTAL) * 100),
    minutes: Math.floor(seconds / 60),
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

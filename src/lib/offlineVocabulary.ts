/**
 * Offline vocabulary: the words the student last saw on the Vocabulary page
 * (today's batch and the reviews due) are kept on the device, so they can
 * still be read and heard without a connection. Read-only: marking a word
 * needs the server and waits for the connection to come back.
 */
export type OfflineWord = {
  id: string;
  word: string;
  translation: string;
  meaning: string;
  pronunciation: string;
  example: string;
  difficulty: string;
};

export type OfflineVocabulary = { savedAt: string; words: OfflineWord[] };

type StorageLike = Pick<Storage, "getItem" | "setItem"> & {
  length: number;
  key: (index: number) => string | null;
};

export const OFFLINE_VOCABULARY_LIMIT = 30;

export function offlineVocabularyKey(userId: string) {
  return `offline-vocabulary:${userId}`;
}

/** Keeps the words to show offline; skips the write when nothing changed. */
export function saveOfflineVocabulary(
  storage: StorageLike,
  userId: string,
  words: OfflineWord[],
  now = new Date(),
): boolean {
  const unique = new Map<string, OfflineWord>();
  for (const w of words) {
    if (unique.size >= OFFLINE_VOCABULARY_LIMIT) break;
    if (!unique.has(w.id))
      unique.set(w.id, {
        id: w.id,
        word: w.word,
        translation: w.translation,
        meaning: w.meaning,
        pronunciation: w.pronunciation,
        example: w.example,
        difficulty: w.difficulty,
      });
  }
  if (!unique.size) return false;
  const list = [...unique.values()];
  const key = offlineVocabularyKey(userId);
  try {
    const previous = loadOfflineVocabulary(storage, userId);
    if (previous && JSON.stringify(previous.words) === JSON.stringify(list)) return false;
    storage.setItem(key, JSON.stringify({ savedAt: now.toISOString(), words: list }));
    return true;
  } catch {
    return false;
  }
}

export function loadOfflineVocabulary(
  storage: Pick<Storage, "getItem">,
  userId: string,
): OfflineVocabulary | null {
  try {
    const parsed = JSON.parse(storage.getItem(offlineVocabularyKey(userId)) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { savedAt, words } = parsed as Partial<OfflineVocabulary>;
    if (typeof savedAt !== "string" || !Array.isArray(words)) return null;
    const valid = words.filter(
      (w): w is OfflineWord =>
        !!w && typeof w === "object" && typeof w.id === "string" && typeof w.word === "string",
    );
    return valid.length ? { savedAt, words: valid } : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user saved on this device by Supabase (sb-<project>-auth-token).
 * Used only while offline: an expired session cannot be refreshed without a
 * connection, which would otherwise send the student to the sign-in screen
 * instead of their saved words.
 */
export function storedOfflineUser(storage: StorageLike): { id: string } | null {
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const parsed = JSON.parse(storage.getItem(key) ?? "null") as {
        user?: { id?: unknown };
      } | null;
      const id = parsed?.user?.id;
      if (typeof id === "string" && id) return { id };
    }
  } catch {
    // storage unavailable or not JSON
  }
  return null;
}

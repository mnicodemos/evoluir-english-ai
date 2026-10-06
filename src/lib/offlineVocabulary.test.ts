import { describe, expect, it } from "vitest";

import {
  loadOfflineVocabulary,
  OFFLINE_VOCABULARY_LIMIT,
  saveOfflineVocabulary,
  storedOfflineUser,
  type OfflineWord,
} from "@/lib/offlineVocabulary";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const word = (id: string): OfflineWord & { category: string } => ({
  id,
  word: `word-${id}`,
  translation: "tradução",
  meaning: "meaning",
  pronunciation: "WURD",
  example: "An example.",
  difficulty: "easy",
  category: "extra field that is not stored",
});

describe("offline vocabulary", () => {
  it("saves the shown words once, without duplicates or extra fields", () => {
    const storage = memoryStorage();
    expect(saveOfflineVocabulary(storage, "u1", [word("a"), word("a"), word("b")])).toBe(true);
    const saved = loadOfflineVocabulary(storage, "u1");
    expect(saved?.words.map((w) => w.id)).toEqual(["a", "b"]);
    expect(saved?.words[0]).not.toHaveProperty("category");
    // Same words again: no rewrite.
    expect(saveOfflineVocabulary(storage, "u1", [word("a"), word("b")])).toBe(false);
  });

  it("keeps at most the offline limit and nothing for an empty list", () => {
    const storage = memoryStorage();
    expect(saveOfflineVocabulary(storage, "u1", [])).toBe(false);
    const many = Array.from({ length: OFFLINE_VOCABULARY_LIMIT + 5 }, (_, i) => word(String(i)));
    saveOfflineVocabulary(storage, "u1", many);
    expect(loadOfflineVocabulary(storage, "u1")?.words).toHaveLength(OFFLINE_VOCABULARY_LIMIT);
  });

  it("keeps each student's words apart and ignores broken data", () => {
    const storage = memoryStorage({ "offline-vocabulary:u2": "{not json" });
    saveOfflineVocabulary(storage, "u1", [word("a")]);
    expect(loadOfflineVocabulary(storage, "u2")).toBeNull();
    expect(loadOfflineVocabulary(storage, "u3")).toBeNull();
  });

  it("finds the user saved by Supabase on the device", () => {
    const storage = memoryStorage({
      theme: "dark",
      "sb-abc-auth-token": JSON.stringify({ access_token: "x", user: { id: "u9" } }),
    });
    expect(storedOfflineUser(storage)).toEqual({ id: "u9" });
    expect(storedOfflineUser(memoryStorage({ "sb-abc-auth-token": "{" }))).toBeNull();
  });
});

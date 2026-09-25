import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, { text: string; expiresAt: number }>();
const spy = { reserve: 0, ai: 0, reads: 0, writes: [] as string[] };
let aiFails = false;

vi.mock("./ai-usage.server", () => ({
  hashAiRequest: async () => "messages-hash",
  loadAiLimit: async () => ({ cache_ttl_seconds: 86400 }),
  readAiCache: async (key: string) => {
    spy.reads++;
    const hit = store.get(key);
    return hit && hit.expiresAt > Date.now() ? hit.text : null;
  },
  reserveAiUsage: async () => {
    spy.reserve++;
    return { eventId: "e", startedAt: Date.now() };
  },
  finishAiUsage: async () => {},
  writeAiCache: async (i: { cacheKey: string; responseText: string; ttlSeconds: number }) => {
    spy.writes.push(i.cacheKey);
    store.set(i.cacheKey, { text: i.responseText, expiresAt: Date.now() + i.ttlSeconds * 1000 });
  },
}));
vi.mock("./gemini.server", () => ({
  GEMINI_TEXT_MODEL: "gemini-test",
  GeminiError: class extends Error {
    status = 503;
  },
  callGemini: async () => {
    spy.ai++;
    if (aiFails) throw new Error("provider down");
    return '{"meanings":[{"definition":"a greeting","translations":["olá"]}]}';
  },
}));

const { callGateway } = await import("./ai-gateway.server");
const { dictionaryCacheKey, meaningsFromRaw } = await import("./dictionary.functions");

const msgs = [{ role: "user" as const, content: "Word: hello" }];
const run = (userId: string, key: string, checked: boolean) =>
  callGateway(msgs, true, { userId, operation: "dictionary", cacheKey: key, cacheChecked: checked });

beforeEach(() => {
  store.clear();
  spy.reserve = spy.ai = spy.reads = 0;
  spy.writes = [];
  aiFails = false;
});

describe("dictionary cache key", () => {
  it("is deterministic, normalized and user-independent", () => {
    expect(dictionaryCacheKey("Hello")).toBe(dictionaryCacheKey("  hello "));
    expect(dictionaryCacheKey("look  up")).toBe(dictionaryCacheKey("look up"));
    expect(dictionaryCacheKey("hello")).not.toBe(dictionaryCacheKey("hollow"));
    expect(dictionaryCacheKey("look up")).not.toBe(dictionaryCacheKey("look"));
  });
});

describe("dictionary cache flow", () => {
  it("MISS reserves usage, calls AI once and saves under the shared key", async () => {
    const key = dictionaryCacheKey("hello");
    await run("user-a", key, true);
    expect(spy).toMatchObject({ reserve: 1, ai: 1, reads: 0 });
    expect(spy.writes).toEqual([key]);
  });

  it("HIT for another user needs no AI and no reservation", async () => {
    const key = dictionaryCacheKey("hello");
    await run("user-a", key, true);
    spy.reserve = spy.ai = 0;
    // What lookupWord does first: read the shared key.
    const { readAiCache } = await import("./ai-usage.server");
    const cached = await readAiCache(key);
    expect(cached).not.toBeNull();
    expect(meaningsFromRaw(cached!)[0]?.translations).toEqual(["olá"]);
    expect(spy).toMatchObject({ reserve: 0, ai: 0 });
  });

  it("expired entries are not hits", async () => {
    const key = dictionaryCacheKey("hello");
    store.set(key, { text: '{"meanings":[{"definition":"x"}]}', expiresAt: Date.now() - 1 });
    const { readAiCache } = await import("./ai-usage.server");
    expect(await readAiCache(key)).toBeNull();
    await run("user-b", key, true);
    expect(spy).toMatchObject({ reserve: 1, ai: 1 });
  });

  it("AI errors still surface and nothing is cached", async () => {
    aiFails = true;
    await expect(run("user-a", dictionaryCacheKey("hello"), true)).rejects.toThrow();
    expect(spy.writes).toEqual([]);
  });

  it("other callers keep the old read-before-reserve path", async () => {
    await callGateway(msgs, true, { userId: "u", operation: "dictionary" });
    expect(spy.reads).toBe(1);
    expect(spy.writes).toEqual(["messages-hash"]);
  });
});

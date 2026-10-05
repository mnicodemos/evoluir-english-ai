import { afterEach, describe, expect, it, vi } from "vitest";

import { readStorage, removeStorage, writeStorage } from "./safeStorage";

describe("safeStorage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never throws when storage is blocked", () => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    vi.stubGlobal("window", {
      localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked },
    });
    expect(readStorage("k")).toBeNull();
    expect(() => writeStorage("k", "v")).not.toThrow();
    expect(() => removeStorage("k")).not.toThrow();
  });

  it("reads and writes when storage works", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    writeStorage("k", "v");
    expect(readStorage("k")).toBe("v");
    removeStorage("k");
    expect(readStorage("k")).toBeNull();
  });
});

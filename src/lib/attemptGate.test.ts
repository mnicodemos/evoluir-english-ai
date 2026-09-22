import { describe, expect, it } from "vitest";

import { createAttemptGate } from "@/lib/attemptGate";
import { isAbandonedUsage } from "@/lib/ai-usage.server";

describe("createAttemptGate", () => {
  it("starts idle and allows an attempt", () => {
    const gate = createAttemptGate();
    expect(gate.isBusy()).toBe(false);
    expect(gate.begin()).toBe(1);
    expect(gate.isBusy()).toBe(true);
  });

  it("blocks a second attempt while one is running", () => {
    const gate = createAttemptGate();
    gate.begin();
    expect(gate.begin()).toBeNull();
  });

  it("releases after success and allows a new attempt", () => {
    const gate = createAttemptGate();
    const id = gate.begin();
    gate.end(id!);
    expect(gate.isBusy()).toBe(false);
    expect(gate.begin()).toBe(2);
  });

  it("releases after an error or a cancel the same way", () => {
    const gate = createAttemptGate();
    const first = gate.begin()!;
    gate.end(first); // error path
    const second = gate.begin()!;
    gate.reset(); // cancel / unmount path
    expect(gate.isBusy()).toBe(false);
    expect(second).toBe(2);
  });

  it("never lets a late answer from an old attempt be applied", () => {
    const gate = createAttemptGate();
    const first = gate.begin()!;
    gate.end(first);
    const second = gate.begin()!;
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });

  it("ignores a release coming from an old attempt", () => {
    const gate = createAttemptGate();
    const first = gate.begin()!;
    gate.end(first);
    const second = gate.begin()!;
    gate.end(first);
    expect(gate.isBusy()).toBe(true);
    expect(gate.isCurrent(second)).toBe(true);
  });
});

describe("isAbandonedUsage", () => {
  const start = "2026-09-22T18:00:00.000Z";
  const at = (seconds: number) => Date.parse(start) + seconds * 1000;

  it("keeps a fresh attempt protected", () => {
    expect(isAbandonedUsage(start, at(10))).toBe(false);
  });

  it("frees an attempt that never finished", () => {
    expect(isAbandonedUsage(start, at(120))).toBe(true);
  });

  it("ignores an unreadable timestamp", () => {
    expect(isAbandonedUsage("not-a-date", at(600))).toBe(false);
  });
});

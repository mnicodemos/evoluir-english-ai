import { describe, expect, it } from "vitest";
import {
  advance,
  canAdvance,
  fallBack,
  isDue,
  markPronounced,
  stepFromMastery,
  vocabularyReviewUpdate,
} from "./vocabularyReview";

const now = new Date("2026-10-04T12:00:00Z");
const days = (iso: string | null) =>
  iso ? Math.round((new Date(iso).getTime() - now.getTime()) / 86400000) : null;

describe("vocabulary review ladder", () => {
  it("climbs 1, 3, 7, 14, 30 days then masters", () => {
    let s = { mastery_level: 0, next_review_at: null as string | null };
    const seen: [number, number | null][] = [];
    for (let i = 0; i < 6; i++) {
      s = advance(s, now);
      seen.push([s.mastery_level, days(s.next_review_at)]);
    }
    expect(seen).toEqual([
      [20, 1],
      [40, 3],
      [60, 7],
      [75, 14],
      [90, 30],
      [100, null],
    ]);
  });

  it("maps legacy mastery to steps", () => {
    expect(stepFromMastery(100)).toBe(6);
    expect(stepFromMastery(80)).toBe(4);
    expect(stepFromMastery(null)).toBe(0);
  });

  it("does not advance before the review is due", () => {
    const future = { mastery_level: 20, next_review_at: "2026-10-05T12:00:00Z" };
    expect(canAdvance(future, now)).toBe(false);
    expect(isDue(future, now)).toBe(false);
    const past = { mastery_level: 20, next_review_at: "2026-10-03T12:00:00Z" };
    expect(canAdvance(past, now)).toBe(true);
    expect(isDue(past, now)).toBe(true);
    expect(canAdvance({ mastery_level: 100, next_review_at: null }, now)).toBe(false);
  });

  it("falls back two steps, never below step 1", () => {
    expect(fallBack({ mastery_level: 90 }, now).mastery_level).toBe(60);
    expect(fallBack({ mastery_level: 20 }, now).mastery_level).toBe(20);
    expect(days(fallBack({ mastery_level: 75 }, now).next_review_at)).toBe(1);
  });

  it("passed pronunciation goes straight to learned with a 30-day review", () => {
    const next = markPronounced(now);
    expect(next.mastery_level).toBe(90);
    expect(days(next.next_review_at)).toBe(30);
  });
});

describe("vocabularyReviewUpdate (applied by the server)", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const tomorrow = "2026-10-11T12:00:00.000Z";

  it("moves a new word one step up and counts the review", () => {
    expect(vocabularyReviewUpdate("known", null, { now })).toEqual({
      mastery_level: 20,
      next_review_at: tomorrow,
      is_difficult: false,
      times_reviewed: 1,
      last_reviewed_at: now.toISOString(),
    });
  });

  it("refuses a step that is not due yet", () => {
    const scheduled = { mastery_level: 20, next_review_at: tomorrow, times_reviewed: 1 };
    expect(vocabularyReviewUpdate("known", scheduled, { now })).toBeNull();
    expect(vocabularyReviewUpdate("forgotten", scheduled, { now })).toBeNull();
  });

  it("marks a pronounced word learned only with a passed pronunciation", () => {
    expect(vocabularyReviewUpdate("pronounced", null, { now })).toBeNull();
    expect(
      vocabularyReviewUpdate("pronounced", null, { now, pronouncedOk: true })?.mastery_level,
    ).toBe(90);
  });

  it("sends a forgotten due word back without counting a review", () => {
    const due = { mastery_level: 60, next_review_at: "2026-10-09T00:00:00Z", times_reviewed: 3 };
    expect(vocabularyReviewUpdate("forgotten", due, { now })).toEqual({
      mastery_level: 20,
      next_review_at: tomorrow,
      is_difficult: true,
    });
  });
});

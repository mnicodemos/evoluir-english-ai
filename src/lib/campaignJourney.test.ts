import { describe, expect, it } from "vitest";

import { uiPt } from "./uiDictionary";
import { fillJourney, journeyDay, journeyMessage } from "./campaignJourney";

const granted = "2026-10-10T15:00:00Z";
const expires = "2026-10-20T15:00:00Z";
const at = (iso: string) => new Date(iso);

describe("journeyDay", () => {
  it("counts 24 h days from the signup", () => {
    expect(journeyDay(granted, expires, at("2026-10-10T16:00:00Z"))).toBe(1);
    expect(journeyDay(granted, expires, at("2026-10-11T15:00:00Z"))).toBe(2);
    expect(journeyDay(granted, expires, at("2026-10-20T14:59:00Z"))).toBe(10);
  });

  it("gives the soft-cut day 11 for 48 h after access ends, then nothing", () => {
    expect(journeyDay(granted, expires, at("2026-10-20T15:00:00Z"))).toBe(11);
    expect(journeyDay(granted, expires, at("2026-10-22T14:00:00Z"))).toBe(11);
    expect(journeyDay(granted, expires, at("2026-10-22T16:00:00Z"))).toBeNull();
  });

  it("is null before the grant", () => {
    expect(journeyDay(granted, expires, at("2026-10-09T15:00:00Z"))).toBeNull();
  });
});

describe("journeyMessage", () => {
  it("has a message for every day of the journey", () => {
    for (let day = 1; day <= 11; day += 1) {
      expect(journeyMessage(day, 5)?.day).toBe(day);
    }
    expect(journeyMessage(12, 5)).toBeNull();
  });

  it("asks for one minute on days 2-4 when the student has not talked yet", () => {
    expect(journeyMessage(3, 0)?.title).toBe("Just 1 minute with EVO");
    expect(journeyMessage(5, 0)?.to).toBe("/mistakes");
  });

  it("personalises day 4 with the conversation count", () => {
    const message = journeyMessage(4, 7)!;
    expect(fillJourney(message.body, 7)).toContain("7 conversations");
  });

  it("has a Portuguese text for every line", () => {
    for (let day = 1; day <= 11; day += 1) {
      for (const count of [0, 3]) {
        const message = journeyMessage(day, count)!;
        for (const text of [message.title, message.body, message.cta]) {
          expect(uiPt[text], text).toBeTruthy();
        }
      }
    }
  });
});

import { describe, expect, it } from "vitest";

import { isWeatherCondition, WEATHER_TALK, weatherRolePlay } from "./weatherTalk";

describe("weather talk", () => {
  it("has a sentence, three words and a question for every condition", () => {
    for (const talk of Object.values(WEATHER_TALK)) {
      expect(talk.sentence.length).toBeGreaterThan(10);
      expect(talk.words).toHaveLength(3);
      expect(talk.question.endsWith("?")).toBe(true);
    }
  });

  it("only accepts known conditions from the URL", () => {
    expect(isWeatherCondition("rain")).toBe(true);
    expect(isWeatherCondition("hurricane")).toBe(false);
    expect(isWeatherCondition(undefined)).toBe(false);
  });

  it("opens AI Speaking with the weather sentence and question", () => {
    const play = weatherRolePlay("rain");
    expect(play.opener).toBe(`${WEATHER_TALK.rain.sentence} ${WEATHER_TALK.rain.question}`);
    expect(play.scenario).toBe("everyday");
    expect(play.role).toContain("rainy");
  });
});

/**
 * "Weather talk": today's weather turned into a tiny English practice — a
 * sentence to hear, three words with translations and a question to answer
 * in AI Speaking. Pure content, keyed by the weather condition.
 */
import type { WeatherCondition } from "@/hooks/useWeatherCondition";

export type WeatherTalk = {
  /** Label shown in English (the practice language). */
  label: string;
  sentence: string;
  words: [string, string][];
  question: string;
};

export const WEATHER_TALK: Record<WeatherCondition, WeatherTalk> = {
  sunny: {
    label: "Sunny",
    sentence: "It's sunny and bright today.",
    words: [
      ["sunny", "ensolarado"],
      ["sunscreen", "protetor solar"],
      ["heat", "calor"],
    ],
    question: "What do you like to do on sunny days?",
  },
  "partly-cloudy": {
    label: "Partly cloudy",
    sentence: "It's partly cloudy, with some sun now and then.",
    words: [
      ["partly", "parcialmente"],
      ["clouds", "nuvens"],
      ["mild", "ameno"],
    ],
    question: "Is this your favourite kind of weather? Why?",
  },
  cloudy: {
    label: "Cloudy",
    sentence: "It's cloudy and a bit grey outside.",
    words: [
      ["cloudy", "nublado"],
      ["grey", "cinzento"],
      ["overcast", "encoberto"],
    ],
    question: "How does cloudy weather change your mood or your plans?",
  },
  rain: {
    label: "Rainy",
    sentence: "It's raining, so don't forget your umbrella.",
    words: [
      ["umbrella", "guarda-chuva"],
      ["drizzle", "garoa"],
      ["soaked", "encharcado"],
    ],
    question: "What do you usually do at home on a rainy day?",
  },
  storm: {
    label: "Stormy",
    sentence: "There's a storm with thunder and lightning.",
    words: [
      ["thunder", "trovão"],
      ["lightning", "relâmpago"],
      ["power cut", "falta de luz"],
    ],
    question: "Are you afraid of storms? What do you do when there is one?",
  },
  snow: {
    label: "Snowy",
    sentence: "It's snowing and very cold outside.",
    words: [
      ["snowflake", "floco de neve"],
      ["freezing", "congelante"],
      ["gloves", "luvas"],
    ],
    question: "Have you ever seen snow? Where would you like to see it?",
  },
  night: {
    label: "Clear night",
    sentence: "It's a quiet, clear night.",
    words: [
      ["starry", "estrelado"],
      ["moonlight", "luar"],
      ["chilly", "friozinho"],
    ],
    question: "What do you usually do in the evening to relax?",
  },
};

export function isWeatherCondition(value: unknown): value is WeatherCondition {
  return typeof value === "string" && value in WEATHER_TALK;
}

/** AI Speaking role for a conversation about today's weather. */
export function weatherRolePlay(condition: WeatherCondition) {
  const talk = WEATHER_TALK[condition];
  return {
    id: `weather-${condition}`,
    label: "Weather talk",
    scenario: "everyday" as const,
    goals: [],
    role: `You are a friendly neighbour making small talk with the student about today's weather where they are (${talk.label.toLowerCase()}). Talk about plans, feelings and clothes that depend on the weather, and use simple weather vocabulary.`,
    opener: `${talk.sentence} ${talk.question}`,
  };
}

import { findLevel } from "@/lib/level";

/**
 * CEFR adaptation for the Writing module. Only the task that is offered, the
 * expected length and the correction priorities change per level: the existing
 * corrector, the evidence flow and the skill profile are untouched.
 */
export type WritingCategory = "everyday" | "professional" | "travel";

export type WritingLevelConfig = {
  level: string;
  label: string;
  /** Expected answer length, in words. */
  minWords: number;
  /** Upper bound of the expected length; `null` means "no ceiling". */
  maxWords: number | null;
  /** Short goal shown discreetly under the header. */
  focus: string;
  /** What the correction should prioritise at this level. */
  priorities: string[];
  tasks: Record<WritingCategory, string[]>;
};

export const WRITING_CATEGORIES: { id: WritingCategory; label: string; hint: string }[] = [
  { id: "everyday", label: "Everyday English", hint: "Family, friends, routine" },
  { id: "professional", label: "Professional English", hint: "Meetings, emails, career" },
  { id: "travel", label: "Travel English", hint: "Airport, hotel, restaurant" },
];

const CONFIGS: Record<string, WritingLevelConfig> = {
  a1: {
    level: "a1",
    label: "A1",
    minWords: 30,
    maxWords: 50,
    focus: "Simple sentences about you, your routine and your family.",
    priorities: [
      "understandability first",
      "basic sentence structure (subject + verb + object)",
      "essential everyday vocabulary",
    ],
    tasks: {
      everyday: [
        "Write 5 sentences about yourself.",
        "Describe your daily routine.",
        "Write about your family.",
        "Write 5 sentences about the food you like.",
        "Describe your house in simple sentences.",
      ],
      professional: [
        "Write 5 sentences about your job.",
        "Write a short message to say you are late for work.",
        "Describe what you do every day at work.",
        "Write a short message to ask for a day off.",
      ],
      travel: [
        "Write 5 sentences about a city you like.",
        "Write a short message to book a hotel room.",
        "Describe what you take in your bag when you travel.",
        "Write 5 sentences about how you go to work.",
      ],
    },
  },
  a2: {
    level: "a2",
    label: "A2",
    minWords: 50,
    maxWords: 80,
    focus: "Common situations, simple past and simple plans.",
    priorities: [
      "clear simple and past tenses",
      "linking sentences with and, but, because",
      "wider everyday vocabulary",
    ],
    tasks: {
      everyday: [
        "Write about what you did last weekend.",
        "Describe a place near your home and why you go there.",
        "Write about your plans for next month.",
        "Describe a day that was different from your routine.",
      ],
      professional: [
        "Write a short email to tell your team you will be out tomorrow.",
        "Describe your first day at a job you had.",
        "Write a short email asking a colleague for help with a task.",
        "Describe a task you do every week at work.",
      ],
      travel: [
        "Write about the last trip you took.",
        "Write an email asking a hotel about breakfast and check-in.",
        "Describe a restaurant you visited and what you ordered.",
        "Write about a place you want to visit next year.",
      ],
    },
  },
  b1: {
    level: "b1",
    label: "B1",
    minWords: 100,
    maxWords: 150,
    focus: "Opinions, short narratives and simple work situations.",
    priorities: [
      "paragraph organisation",
      "grammar accuracy in the tenses you use",
      "clarity of the message",
      "some variety in vocabulary",
    ],
    tasks: {
      everyday: [
        "Tell the story of something unexpected that happened to you.",
        "Explain your opinion about working from home.",
        "Describe a habit you changed and how it went.",
        "Explain why a hobby of yours is important to you.",
      ],
      professional: [
        "Write an email asking a client to reschedule a meeting.",
        "Write a status update about your current project for your team.",
        "Describe a problem at work and how you solved it.",
        "Explain why you would be a good fit for a job you want.",
      ],
      travel: [
        "Write a review of a place you visited.",
        "Write a polite complaint about a hotel room that was not clean.",
        "Explain to a tourist how to spend one day in your city.",
        "Describe a travel problem you had and what you did.",
      ],
    },
  },
  b2: {
    level: "b2",
    label: "B2",
    minWords: 150,
    maxWords: 220,
    focus: "Developed answers with clear structure and varied language.",
    priorities: [
      "text organisation and cohesion",
      "grammar range and accuracy",
      "clarity and precision",
      "vocabulary variety",
    ],
    tasks: {
      everyday: [
        "Describe your daily routine from morning to night.",
        "Tell a friend by message what you did last weekend.",
        "Describe your home and your favourite room in it.",
        "Write about a meal you love and how you prepare it.",
        "Tell me about a person in your family you admire.",
        "Describe your hometown to someone who has never visited it.",
        "Tell me what you usually do to relax after a busy day.",
        "Describe a hobby you started recently and why you like it.",
      ],
      professional: [
        "Write an email asking a client to reschedule a meeting.",
        "Describe your professional experience in a short paragraph.",
        "Explain a project you are proud of and your role in it.",
        "Write an email introducing yourself to a new international client.",
        "Describe a difficult situation at work and how you solved it.",
        "Explain why you would be a good fit for your dream job.",
        "Write an email answering a client who is unhappy with a delay.",
      ],
      travel: [
        "Tell me about the last trip you took.",
        "Write an email to a hotel asking about check-in time and breakfast.",
        "Describe your dream destination and what you would do there.",
        "Write a polite complaint about a room that was not clean.",
        "Describe what happened when a flight of yours was delayed.",
        "Write a short review of a restaurant you visited abroad.",
        "Explain to a tourist how to get from the airport to your city centre.",
      ],
    },
  },
  c1: {
    level: "c1",
    label: "C1",
    minWords: 220,
    maxWords: 300,
    focus: "Argumentation, analysis and professional or academic writing.",
    priorities: [
      "quality of argumentation and supporting detail",
      "precision of grammar and word choice",
      "register appropriate to a professional reader",
      "cohesion across paragraphs",
    ],
    tasks: {
      everyday: [
        "Argue for or against the idea that social media improves relationships.",
        "Compare life in a big city with life in a small town and take a position.",
        "Analyse how remote work has changed the way people organise their week.",
        "Discuss whether people should be expected to answer messages instantly.",
      ],
      professional: [
        "Write a recommendation to your board about postponing a product launch.",
        "Analyse the main risks of a project you know and propose mitigation.",
        "Write a professional response to negative feedback from a key client.",
        "Compare two approaches to a work problem and recommend one.",
      ],
      travel: [
        "Discuss the impact of mass tourism on a destination you know.",
        "Write a formal complaint letter about a cancelled flight and its consequences.",
        "Argue whether cities should limit short-term holiday rentals.",
        "Analyse what makes a destination worth returning to.",
      ],
    },
  },
  c2: {
    level: "c2",
    label: "C2",
    minWords: 300,
    maxWords: null,
    focus: "Sophisticated, critical writing with nuance and advanced register.",
    priorities: [
      "nuance and critical positioning",
      "stylistic control and natural idiomatic range",
      "sustained, tightly reasoned argument",
      "advanced formal register",
    ],
    tasks: {
      everyday: [
        "Take a critical position on the idea that technology makes us more isolated.",
        "Write a reflective essay on how your priorities have changed over ten years.",
        "Argue against a popular opinion you consider poorly reasoned.",
        "Discuss the tension between personal ambition and personal life.",
      ],
      professional: [
        "Write a critical assessment of a strategy you believe is flawed, with alternatives.",
        "Write an executive briefing defending an unpopular but necessary decision.",
        "Evaluate the long-term consequences of prioritising growth over stability.",
        "Write a persuasive proposal to change a process across an organisation.",
      ],
      travel: [
        "Write an essay on whether sustainable tourism is achievable in practice.",
        "Critique the way a destination markets itself against what visitors find.",
        "Argue whether travel genuinely broadens perspective, with evidence.",
        "Reflect on a journey that changed how you see a place or a culture.",
      ],
    },
  },
};

export function writingLevelConfig(level: string | null | undefined): WritingLevelConfig {
  const info = findLevel(level);
  return CONFIGS[info.value] ?? CONFIGS["b2"]!;
}

/** "150–220 words" / "300+ words" — used in the UI and in the correction context. */
export function expectedLengthLabel(config: WritingLevelConfig) {
  return config.maxWords === null
    ? `${config.minWords}+ words`
    : `${config.minWords}–${config.maxWords} words`;
}

/**
 * One task per theme for the round. Tasks already answered are skipped while
 * fresh ones exist, and the rotation offset keeps the round moving forward.
 */
export function pickWritingTasks(options: {
  config: WritingLevelConfig;
  history?: string[];
  rotation?: number;
}): string[] {
  const { config, history = [], rotation = 0 } = options;
  return WRITING_CATEGORIES.map(({ id }) => {
    const pool = config.tasks[id];
    if (pool.length === 0) return "";
    const fresh = pool.filter((task) => !history.includes(task));
    const usable = fresh.length > 0 ? fresh : pool;
    const index = (((rotation % usable.length) + usable.length) % usable.length) as number;
    return usable[index]!;
  }).filter(Boolean);
}

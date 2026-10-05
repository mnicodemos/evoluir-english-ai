/** Conversation scenarios for AI Speaking and the openers already used, kept per browser. */
import { Briefcase, Coffee, Plane } from "lucide-react";

export const scenarios = [
  {
    id: "everyday",
    label: "Everyday English",
    hint: "Family, friends, routine",
    icon: Coffee,
    fallbackOpeners: [
      "Hi! Great to see you again. How was your day today?",
      "Hey! Imagine we're neighbours chatting over coffee. What did you do last weekend?",
      "Hello! Let's talk about your routine. What is the first thing you do every morning?",
      "Hi there! Tell me about your family. Who do you spend the most time with?",
      "Hey! Let's chat about food. What did you cook or eat yesterday?",
      "Hi! Picture us meeting at a friend's birthday party. What do you usually talk about at parties?",
    ],
  },
  {
    id: "professional",
    label: "Professional English",
    hint: "Meetings, interviews, networking",
    icon: Briefcase,
    fallbackOpeners: [
      "Welcome! Let's warm up for work situations. Can you tell me what you do and what a typical week looks like?",
      "Hi! Imagine I'm interviewing you for your dream job. Tell me a little about yourself.",
      "Hello! You're about to start a team meeting. Can you give a quick status update on your current project?",
      "Hi! We just met at a networking event. What do you do, and why do you like it?",
      "Welcome! You need to ask your manager for a day off. How would you start that conversation?",
      "Hi! A new colleague just joined your team. How would you welcome them and explain your work?",
    ],
  },
  {
    id: "travel",
    label: "Travel English",
    hint: "Airport, hotel, restaurant",
    icon: Plane,
    fallbackOpeners: [
      "Let's travel! You just landed and you're at the check-in desk of your hotel. What do you say to the receptionist?",
      "Ready for a trip? You're at the airport and your flight is delayed. What do you ask at the information desk?",
      "Let's go! You're at a restaurant in New York. How do you order your meal?",
      "Imagine you're lost in London. Stop a stranger and ask for directions to the nearest station.",
      "You're checking out of your hotel and noticed a wrong charge on the bill. What do you say?",
      "You just met another traveller on a train. Introduce yourself and ask about their trip.",
    ],
  },
] as const;

export const OPENERS_STORAGE_KEY = "ai-talking-openers-v2";

/** Every topic already used, so the AI never opens with the same subject twice. */
export function loadUsedOpeners(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(OPENERS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function rememberOpener(opener: string): string[] {
  const next = [...loadUsedOpeners().filter((line) => line !== opener), opener].slice(-40);
  try {
    window.localStorage.setItem(OPENERS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — repetition guard just won't persist.
  }
  return next;
}

/** A different scenario each day, so the daily subject always changes. */
export function scenarioOfTheDay(offset = 0) {
  const day = Math.floor(Date.now() / 86400000);
  return scenarios[(day + offset) % scenarios.length]!;
}

/** Real-life role-plays: EVO takes a role and the student plays themself. */
export type RolePlay = {
  id: string;
  label: string;
  /** Skill bucket used for the session report. */
  scenario: "everyday" | "professional" | "travel";
  /** Study plan goals this situation suits best. */
  goals: string[];
  role: string;
  opener: string;
};

export const rolePlays: RolePlay[] = [
  {
    id: "job-interview",
    label: "Job interview",
    scenario: "professional",
    goals: ["interview", "work"],
    role: "You are a friendly hiring manager interviewing the student for a job in their field. Ask one typical interview question at a time and react to the answers.",
    opener: "Hello, thank you for coming in today. Could you tell me a little about yourself?",
  },
  {
    id: "team-meeting",
    label: "Team meeting",
    scenario: "professional",
    goals: ["work"],
    role: "You are the student's manager in a weekly team meeting. Ask about progress, deadlines, problems and next steps.",
    opener:
      "Good morning! Let's start our weekly meeting. What have you been working on this week?",
  },
  {
    id: "hotel-check-in",
    label: "Hotel check-in",
    scenario: "travel",
    goals: ["travel"],
    role: "You are a hotel receptionist checking the student in: reservation, room, breakfast, Wi-Fi and checkout time.",
    opener: "Good evening and welcome! Do you have a reservation with us?",
  },
  {
    id: "restaurant",
    label: "At a restaurant",
    scenario: "travel",
    goals: ["travel", "conversation"],
    role: "You are a waiter at a casual restaurant taking the student's order, suggesting dishes and bringing the bill.",
    opener: "Hi there, welcome! Can I get you something to drink while you look at the menu?",
  },
  {
    id: "airport",
    label: "Airport check-in",
    scenario: "travel",
    goals: ["travel"],
    role: "You are an airline check-in agent: destination, passport, luggage, seat and boarding time.",
    opener: "Good morning! Where are you flying to today?",
  },
  {
    id: "doctor",
    label: "At the doctor's",
    scenario: "everyday",
    goals: ["conversation", "certification"],
    role: "You are a doctor at a clinic and the student is the patient describing how they feel.",
    opener: "Hello, please have a seat. What brings you in today?",
  },
];

/** Role-plays ordered so the ones matching the study plan goal come first. */
export function rolePlaysForGoal(goal: string | null | undefined): RolePlay[] {
  const matching = rolePlays.filter((play) => goal && play.goals.includes(goal));
  return [...matching, ...rolePlays.filter((play) => !matching.includes(play))];
}

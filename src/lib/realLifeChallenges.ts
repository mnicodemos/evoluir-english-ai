/**
 * Real-Life Challenge (prototype 1, owner request 2026-10-27): a short,
 * optional situation under a lesson's Learning Guide. Content is static and
 * reviewed (no AI call), grounded in the lesson's own summary. It never
 * touches the checklist, the quiz or lesson completion.
 */

export type ChallengeOutcome = "works" | "adjust";

export type ChallengeOption = {
  id: string;
  /** The student's possible message (English learning content). */
  text: string;
  outcome: ChallengeOutcome;
  /** What happens next in the situation. */
  consequence: string;
  /** EVO's explanation, based on the lesson summary. */
  feedback: string;
};

export type RealLifeChallenge = {
  key: string;
  title: string;
  situation: string;
  task: string;
  options: ChallengeOption[];
};

export const REAL_LIFE_CHALLENGES: Record<string, RealLifeChallenge> = {
  "b1-u2-l4": {
    key: "b1-u2-l4",
    title: "Asking a client for two more days",
    situation:
      "You are preparing a project report for your client, Mr. Davies. It was due on Wednesday, but you need two more days to finish it properly.",
    task: "Which email would you send?",
    options: [
      {
        id: "informal",
        text: "Hey Mark! Super busy here, the report isn't ready lol. Friday ok? Thx!",
        outcome: "adjust",
        consequence:
          "Mr. Davies replies briefly and asks whether the project is under control. The casual tone made the delay sound unplanned.",
        feedback:
          "This message is fine for a friend, but not for a client. A professional email needs a polite greeting (Dear Mr. Davies), the reason for writing (I am writing to...), a polite request and a clear next step.",
      },
      {
        id: "direct",
        text: "Mr. Davies, the report will be late. You must give us until Friday. Confirm this today.",
        outcome: "adjust",
        consequence:
          "Mr. Davies agrees, but his reply is cold. The request sounded like an order, not a question.",
        feedback:
          "The structure is clear, but 'You must' and 'Confirm this today' sound demanding. Modal verbs like 'could' and 'would' make a request polite: 'Could we deliver it on Friday?'",
      },
      {
        id: "professional",
        text: "Dear Mr. Davies, I am writing to update you on the project report. We need two more days to check the final figures. Could we deliver it on Friday? Please let me know if this works for you.",
        outcome: "works",
        consequence:
          "Mr. Davies thanks you for the update and agrees to Friday. He appreciates knowing the reason in advance.",
        feedback:
          "Great choice. You used all four parts of a professional email: a polite greeting, the reason for writing, a polite request with 'could', and a clear next step ('Please let me know...').",
      },
    ],
  },
};

export function challengeFor(key: string | null | undefined): RealLifeChallenge | null {
  if (!key) return null;
  return REAL_LIFE_CHALLENGES[key] ?? null;
}

export function challengeOption(
  challenge: RealLifeChallenge,
  optionId: string | null,
): ChallengeOption | null {
  if (!optionId) return null;
  return challenge.options.find((option) => option.id === optionId) ?? null;
}

/** Local, device-only record that the challenge was completed. */
export function challengeStorageKey(userId: string, lessonKey: string) {
  return `real-life-challenge:${userId}:${lessonKey}`;
}

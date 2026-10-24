import { describe, expect, it } from "vitest";

import {
  conversationChallengeKind,
  studyDayNumber,
  withConversationChallenge,
} from "./conversationChallenge";
import type { SkillQuest } from "./skillQuest";

const listeningQuest: SkillQuest = {
  skill: "listening",
  gapType: "INSUFFICIENT_EVIDENCE",
  reason: "evidence_below_minimum",
  currentState: "RECOGNITION",
  targetState: "RECOGNITION",
  action: "add_evidence",
  resource: { type: "listening", title: "Listening", to: "/listening", ceiling: "RECOGNITION" },
  priority: 1,
  ruleVersion: "skill-quest-v1",
};

/** The first day from `from` whose kind is `kind`. */
function dayOf(kind: "teacher" | "call" | null, from = "2026-10-24") {
  for (let i = 0; i < 8; i += 1) {
    const day = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (conversationChallengeKind(day) === kind) return day;
  }
  throw new Error("no day");
}

describe("conversation challenge", () => {
  it("alternates AI Teacher, skill, video call, skill over four days", () => {
    const start = dayOf("teacher");
    const kinds = [0, 1, 2, 3].map((i) =>
      conversationChallengeKind(
        new Date((studyDayNumber(start) + i) * 86_400_000).toISOString().slice(0, 10),
      ),
    );
    expect(kinds).toEqual(["teacher", null, "call", null]);
  });

  it("keeps the skill quest on skill days", () => {
    const quest = withConversationChallenge(listeningQuest, {
      day: dayOf(null),
      prioritySkill: "grammar",
      taken: [],
    });
    expect(quest).toBe(listeningQuest);
  });

  it("opens the video call or the AI Teacher on their days", () => {
    const call = withConversationChallenge(listeningQuest, {
      day: dayOf("call"),
      prioritySkill: "grammar",
      taken: [],
    });
    expect(call?.resource.to).toBe("/call");
    expect(call?.skill).toBe("speaking");
    const teacher = withConversationChallenge(null, {
      day: dayOf("teacher"),
      prioritySkill: "listening",
      taken: [],
    });
    expect(teacher?.resource.to).toBe("/teacher");
    expect(teacher?.skill).toBe("grammar");
  });

  it("never repeats a place Practice now or the Quick Win opens", () => {
    const quest = withConversationChallenge(listeningQuest, {
      day: dayOf("teacher"),
      prioritySkill: "grammar",
      taken: ["/teacher"],
    });
    expect(quest?.resource.to).toBe("/call");
    expect(quest?.skill).toBe("speaking");
  });

  it("skips the video call when the priority is speaking", () => {
    const quest = withConversationChallenge(listeningQuest, {
      day: dayOf("call"),
      prioritySkill: "speaking",
      taken: [],
    });
    expect(quest?.resource.to).toBe("/teacher");
    const none = withConversationChallenge(listeningQuest, {
      day: dayOf("call"),
      prioritySkill: "speaking",
      taken: ["/teacher"],
    });
    expect(none).toBe(listeningQuest);
  });
});

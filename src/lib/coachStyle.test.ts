import { describe, expect, it } from "vitest";

import { beginnerOpenerRule, coachOpenerMessages, coachReplyMessages } from "./ai-prompts";

describe("video call style", () => {
  it("is an informal chat with EVO as a friend, without teacher tips", () => {
    const [call] = coachReplyMessages("everyday", "b1", "conversation", undefined, [], undefined, {
      casual: true,
      name: "Marcelo Nicodemos",
    });
    expect(call?.content).toContain("informal chat between friends");
    expect(call?.content).toContain("first name is Marcelo;");
    expect(call?.content).not.toContain("'Tip:'");
    expect(call?.content).not.toContain("CELTA");
    // Honest about being an AI: no invented human life, says so when asked.
    expect(call?.content).toContain("You are an AI.");
    expect(call?.content).toContain("never invent a body or a human life");
  });

  it("leaves AI Speaking as the short teacher turns", () => {
    const [lesson] = coachReplyMessages("everyday", "b1", "conversation", undefined, []);
    expect(lesson?.content).toContain("CELTA-certified English teacher");
    expect(lesson?.content).toContain("'Tip:'");
  });

  it("keeps a real-situation role-play in its role even on the call", () => {
    const [play] = coachReplyMessages(
      "travel",
      "b1",
      "travel",
      undefined,
      [],
      "You are a hotel receptionist.",
      { casual: true },
    );
    expect(play?.content).toContain("Role-play — You are a hotel receptionist");
  });

  it("opens the call like a friend picking up", () => {
    const [system, start] = coachOpenerMessages("everyday", "a2", "conversation", undefined, [], {
      casual: true,
    });
    expect(system?.content).toContain("picking up a video call");
    expect(system?.content).toContain("You are an AI.");
    expect(system?.content).not.toContain("something small about your day");
    expect(start?.content).toBe("*video call connects*");
  });
});

describe("beginner openers (A1-A2)", () => {
  it("asks a short personal question even in a work scenario", () => {
    const [system] = coachOpenerMessages("professional", "a1", "work", undefined, []);
    expect(system?.content).toContain("A1 beginner");
    expect(system?.content).toContain("at most 12 words");
    expect(system?.content).toContain("never a situation to act out");
  });

  it("applies to the video call opener too", () => {
    const [system] = coachOpenerMessages("everyday", "a2", "conversation", undefined, [], {
      casual: true,
    });
    expect(system?.content).toContain("A2 beginner");
  });

  it("leaves B1 and above as they are", () => {
    expect(beginnerOpenerRule("b1")).toBe("");
    const [system] = coachOpenerMessages("professional", "c1", "work", undefined, []);
    expect(system?.content).not.toContain("beginner");
  });
});

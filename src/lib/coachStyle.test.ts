import { describe, expect, it } from "vitest";

import { coachOpenerMessages, coachReplyMessages } from "./ai-prompts";

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
    expect(start?.content).toBe("*video call connects*");
  });
});

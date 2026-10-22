import { describe, expect, it } from "vitest";

import { lastSentence, writingHelpMessages } from "./writingHelp";

describe("writing help", () => {
  it("finds the last sentence of the draft", () => {
    expect(lastSentence("I like tea. I goes to work by bus.")).toBe("I goes to work by bus.");
    expect(lastSentence("  ")).toBe("");
  });

  it("never asks EVO to write the whole answer", () => {
    const [system, user] = writingHelpMessages({
      kind: "check",
      task: "Describe your morning",
      level: "A2",
      draft: "I wake up at 7. I eats bread.",
      question: "",
      lang: "pt",
    });
    expect(system!.content).toContain("Never write the student's whole answer");
    expect(system!.content).toContain("Brazilian Portuguese");
    expect(user!.content).toContain("Last sentence: I eats bread.");
  });
});

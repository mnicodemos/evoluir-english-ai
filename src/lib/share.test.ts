import { describe, expect, it } from "vitest";

import { speakingShareText, whatsappShareUrl } from "./share";

describe("share", () => {
  it("builds WhatsApp's share link", () => {
    expect(whatsappShareUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });

  it("shares only the achievement, in the language on screen", () => {
    const report = { fluency: 78, grammar: 70, vocabulary: 82 };
    expect(speakingShareText(report, { lang: "pt", level: "B1", streakDays: 12 })).toBe(
      "🗣️ Acabei de conversar em inglês com a EVO no Evoluir+!\nFluência 78 · Gramática 70 · Vocabulário 82\nNível B1 · 🔥 12 dias seguidos",
    );
    expect(speakingShareText(report, { lang: "en", streakDays: 1 })).toBe(
      "🗣️ I just had a conversation in English with EVO on Evoluir+!\nFluency 78 · Grammar 70 · Vocabulary 82",
    );
  });
});

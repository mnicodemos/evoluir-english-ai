import type { ConversationReport } from "@/lib/ai-prompts";

/** A mailto link; the student picks the address in their email app. */
export function emailShareUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** WhatsApp's share link: the student picks the contact in WhatsApp itself. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * A finished conversation with EVO as a short brag to share (user request):
 * only the achievement (the three scores, level and streak), never the
 * student's mistakes or EVO's suggestions, in the language on screen.
 */
export function speakingShareText(
  report: Pick<ConversationReport, "fluency" | "grammar" | "vocabulary">,
  options: {
    lang: "pt" | "en";
    level?: string | null | undefined;
    streakDays?: number | null | undefined;
  },
): string {
  const pt = options.lang === "pt";
  const scores = pt
    ? `Fluência ${report.fluency} · Gramática ${report.grammar} · Vocabulário ${report.vocabulary}`
    : `Fluency ${report.fluency} · Grammar ${report.grammar} · Vocabulary ${report.vocabulary}`;
  const extras = [
    options.level ? (pt ? `Nível ${options.level}` : `Level ${options.level}`) : null,
    options.streakDays && options.streakDays > 1
      ? pt
        ? `🔥 ${options.streakDays} dias seguidos`
        : `🔥 ${options.streakDays} days in a row`
      : null,
  ].filter(Boolean);
  return [
    pt
      ? "🗣️ Acabei de conversar em inglês com a EVO no Evoluir+!"
      : "🗣️ I just had a conversation in English with EVO on Evoluir+!",
    scores,
    extras.join(" · "),
  ]
    .filter(Boolean)
    .join("\n");
}

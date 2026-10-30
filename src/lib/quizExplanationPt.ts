/**
 * Portuguese for the quiz explanations (owner request, 2026-10-30: at A1-A2
 * the "why" after a quiz was English only, so a beginner who got it wrong
 * often could not read why). The lesson's explanations are translated once
 * and shared: lessons are the same text for every student of a level, so the
 * cache key is the explanations themselves, never the student or the lesson id.
 */

/** Levels that see the Portuguese at once; the others get it on request. */
export function showsExplanationPt(level: string | null | undefined): boolean {
  return level === "A1" || level === "A2";
}

/** Normalized explanations in question order, the request and the cache source. */
export function explanationsToTranslate(explanations: string[]): string[] {
  return explanations.map((text) => text.replace(/\s+/g, " ").trim());
}

/**
 * Reads the model's {"pt":[...]} answer: one Portuguese line per explanation,
 * in order. A missing or extra line, or one that is not text, leaves that
 * explanation without Portuguese ("") instead of shifting the rest.
 */
export function parseExplanationsPt(raw: string, count: number): string[] {
  let parsed: unknown;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
  } catch {
    return Array.from({ length: count }, () => "");
  }
  const list =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { pt?: unknown }).pt)
      ? ((parsed as { pt: unknown[] }).pt as unknown[])
      : [];
  return Array.from({ length: count }, (_, index) => {
    const item = list[index];
    return typeof item === "string" ? item.replace(/\s+/g, " ").trim().slice(0, 400) : "";
  });
}

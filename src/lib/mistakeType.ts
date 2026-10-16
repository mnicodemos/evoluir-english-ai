/**
 * My mistakes groups the saved phrases in tabs by type of mistake (user
 * request). The AI writes the category freely ("grammar", "Word order",
 * "verb tense"...), so it is folded into a few fixed tabs here.
 */
export const MISTAKE_TYPES = [
  "grammar",
  "vocabulary",
  "spelling",
  "punctuation",
  "word order",
  "other",
] as const;

export type MistakeType = (typeof MISTAKE_TYPES)[number];

/** English tab labels, translated on screen through uiPt. */
export const MISTAKE_TYPE_LABEL: Record<MistakeType, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  spelling: "Spelling",
  punctuation: "Punctuation",
  "word order": "Word order",
  other: "Other",
};

export function mistakeTypeOf(category: string | null | undefined): MistakeType {
  const value = (category ?? "").trim().toLowerCase();
  if (!value) return "grammar";
  if (/order|position|placement/.test(value)) return "word order";
  if (/spell|typo|capital/.test(value)) return "spelling";
  if (/punctu|comma|apostroph/.test(value)) return "punctuation";
  if (/vocab|word choice|collocation|lexic|preposition/.test(value)) return "vocabulary";
  if (/gramm|tense|verb|article|plural|agreement|pronoun|syntax/.test(value)) return "grammar";
  return "other";
}

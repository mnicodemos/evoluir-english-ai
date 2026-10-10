// Model prices shared by the usage recorder (server) and the admin benchmark,
// which recomputes cost from stored tokens so a price added later also prices
// earlier calls.

/**
 * Official Gemini Developer API paid-tier prices (USD per 1M tokens, standard),
 * ai.google.dev/gemini-api/docs/pricing, read 2026-09-25. Only models called
 * with the personal Gemini key are listed; anything else stays null (N/D).
 */
export const AI_MODEL_PRICING: Record<
  string,
  { inputPricePerMillionTokens: number; outputPricePerMillionTokens: number }
> = {
  "gemini-3.5-flash-lite": { inputPricePerMillionTokens: 0.3, outputPricePerMillionTokens: 2.5 },
  "gemini-3.5-flash": { inputPricePerMillionTokens: 1.5, outputPricePerMillionTokens: 9.0 },
  // What Google actually billed (owner's billing report, 1-9 Oct 2026, BRL at
  // the report's USD 1 = 5.93): input 343,937 tokens R$ 1.53, output 232,140
  // R$ 5.16. Half the list price read on 2026-10-06; output includes thinking.
  "gemini-3.6-flash": { inputPricePerMillionTokens: 0.75, outputPricePerMillionTokens: 3.75 },
  // TTS: text in, audio out. Confirmed in the owner's billing (2 Sep-9 Oct 2026,
  // SKUs "Gemini 2.0 Flash TTS"): text input $0.50, audio output $10.00 per 1M.
  "gemini-2.5-flash-preview-tts": {
    inputPricePerMillionTokens: 0.5,
    outputPricePerMillionTokens: 10.0,
  },
};

/** The token counts Gemini returns with every answer (generateContent and its stream). */
export type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  /** Part of promptTokenCount Google served from its automatic cache. */
  cachedContentTokenCount?: number;
};

/**
 * Cached prompt tokens are billed at 10% of the input price (owner's billing,
 * 2 Sep-9 Oct 2026: 3.5 flash-lite $0.03, 3.5 flash $0.15, 3.6 flash $0.075 per 1M,
 * a tenth of each input price), so they are counted as a tenth of a token.
 */
export const CACHED_INPUT_SHARE = 0.1;

/**
 * Billable tokens of one Gemini answer: the prompt (text or audio) in, with
 * cached tokens at their billed tenth, and the answer plus any thinking out.
 * Null when the answer carried no counts, so a call without them stays "not
 * measured" instead of costing zero.
 */
export function geminiUsageTokens(
  usage: GeminiUsageMetadata | null | undefined,
): { inputTokens: number; outputTokens: number } | null {
  if (!usage || typeof usage.promptTokenCount !== "number") return null;
  const cached = Math.min(usage.promptTokenCount, Math.max(0, usage.cachedContentTokenCount ?? 0));
  return {
    inputTokens: Math.round(usage.promptTokenCount - cached + cached * CACHED_INPUT_SHARE),
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
  };
}

export function estimateAiCost(
  model: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): number | null {
  const price = model ? AI_MODEL_PRICING[model] : undefined;
  if (!price || typeof inputTokens !== "number" || typeof outputTokens !== "number") return null;
  return (
    (inputTokens / 1_000_000) * price.inputPricePerMillionTokens +
    (outputTokens / 1_000_000) * price.outputPricePerMillionTokens
  );
}

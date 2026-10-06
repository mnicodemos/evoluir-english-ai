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
  // Standard tier, effective through 2026-12-31 (Google doubles it on 2027-01-01);
  // output includes thinking tokens. Read 2026-10-06.
  "gemini-3.6-flash": { inputPricePerMillionTokens: 1.5, outputPricePerMillionTokens: 7.5 },
};

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

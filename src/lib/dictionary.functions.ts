import { createServerFn } from "@tanstack/react-start";

export type DictionaryEntry = {
  found: boolean;
  word: string;
  ipaUs: string | null;
  ipaUk: string | null;
  meanings: {
    partOfSpeech: string | null;
    context: string | null;
    definition: string;
    translations: string[];
    example: { en: string; pt: string } | null;
  }[];
  sourceUrl: string;
};

function decode(text: string) {
  return text
    .replace(/<!--\s*-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses the Reverso Context page when it is reachable. */
function parseReverso(html: string) {
  const translations: string[] = [];
  for (const m of html.matchAll(/<a[^>]*class="[^"]*\btranslation\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const t = decode(m[1]!);
    if (t && t.length < 40 && !translations.includes(t)) translations.push(t);
  }

  const src: string[] = [];
  for (const m of html.matchAll(/<div class="src ltr[^"]*">([\s\S]*?)<\/div>/g)) src.push(decode(m[1]!));
  const trg: string[] = [];
  for (const m of html.matchAll(/<div class="trg ltr[^"]*">([\s\S]*?)<\/div>/g)) trg.push(decode(m[1]!));

  const pairs: { en: string; pt: string }[] = [];
  for (let i = 0; i < Math.min(src.length, trg.length); i += 1) {
    if (src[i] && trg[i]) pairs.push({ en: src[i]!, pt: trg[i]! });
  }
  return { translations, pairs };
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/**
 * Looks a word up on context.reverso.net (English -> Portuguese) and returns the
 * translations plus bilingual example sentences. Reverso often blocks server
 * requests, so when the page cannot be read the entry is written by the AI in
 * the same Reverso Context format.
 */
export const lookupWord = createServerFn({ method: "GET" })
  .inputValidator((input: { term: string }) => ({ term: String(input.term ?? "").trim() }))
  .handler(async ({ data }): Promise<DictionaryEntry> => {
    const term = data.term.replace(/\s+/g, " ").trim().toLowerCase();
    const sourceUrl = `https://context.reverso.net/translation/english-portuguese/${encodeURIComponent(term)}`;
    const empty: DictionaryEntry = {
      found: false,
      word: term,
      ipaUs: null,
      ipaUk: null,
      meanings: [],
      sourceUrl,
    };
    if (term.length < 2) return empty;

    let translations: string[] = [];
    let pairs: { en: string; pt: string }[] = [];

    try {
      const res = await fetch(sourceUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8",
        },
      });
      if (res.ok) {
        const parsed = parseReverso(await res.text());
        translations = parsed.translations;
        pairs = parsed.pairs;
      }
    } catch {
      /* fall through to the AI writer below */
    }

    // Build a structured entry that groups definitions, translations and examples.
    try {
      const { callGemini } = await import("./gemini.server");
      const raw = await callGemini(
        [
          {
            role: "system",
            content:
              "You are a bilingual English-Portuguese (Brazil) dictionary. Reply with JSON only.",
          },
          {
            role: "user",
            content: `Word: "${term}". Reverso Context translations: ${JSON.stringify(
              translations.slice(0, 8),
            )}. Example pairs: ${JSON.stringify(
              pairs.slice(0, 8),
            )}. Return JSON: {"meanings":[{"partOfSpeech":"noun","context":"cognition","definition":"short English definition","translations":["pt"],"example":{"en":"natural English sentence using the term","pt":"Brazilian Portuguese translation"}}]}. Up to 4 meanings. Use Reverso examples when possible. If the word does not exist in English, return {"meanings":[]}.`,
          },
        ],
        true,
      );
      if (raw) {
        const parsed = parseJson<{
          meanings?: {
            partOfSpeech?: string;
            context?: string;
            definition?: string;
            translations?: string[];
            example?: { en?: string; pt?: string } | null;
          }[];
        }>(raw, {});
        const meanings = (parsed.meanings ?? [])
          .filter((m) => m.definition || (m.translations && m.translations.length > 0))
          .slice(0, 5)
          .map((m) => ({
            partOfSpeech: m.partOfSpeech ?? null,
            context: m.context ?? null,
            definition: String(m.definition ?? ""),
            translations: (m.translations ?? []).filter(Boolean).slice(0, 6),
            example:
              m.example && m.example.en && m.example.pt
                ? { en: String(m.example.en), pt: String(m.example.pt) }
                : null,
          }));
        if (meanings.length > 0) {
          return { found: true, word: term, ipaUs: null, ipaUk: null, meanings, sourceUrl };
        }
      }
    } catch {
      /* fall back to raw Reverso data if available */
    }

    if (pairs.length === 0 && translations.length === 0) return empty;

    // Raw fallback: one meaning per Reverso example pair.
    return {
      found: true,
      word: term,
      ipaUs: null,
      ipaUk: null,
      meanings: pairs.slice(0, 6).map((p) => ({
        partOfSpeech: null,
        context: null,
        definition: "",
        translations: translations.slice(0, 4),
        example: p,
      })),
      sourceUrl,
    };
  });

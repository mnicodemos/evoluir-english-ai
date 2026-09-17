/** Extracts study items (irregular verbs, phrasal verbs, linking sounds) from lesson text. */

type Irregular = { base: string; past: string; participle: string; pt: string };

const IRREGULARS: Irregular[] = [
  { base: "be", past: "was/were", participle: "been", pt: "ser / estar" },
  { base: "become", past: "became", participle: "become", pt: "tornar-se" },
  { base: "begin", past: "began", participle: "begun", pt: "começar" },
  { base: "bring", past: "brought", participle: "brought", pt: "trazer" },
  { base: "build", past: "built", participle: "built", pt: "construir" },
  { base: "buy", past: "bought", participle: "bought", pt: "comprar" },
  { base: "choose", past: "chose", participle: "chosen", pt: "escolher" },
  { base: "come", past: "came", participle: "come", pt: "vir" },
  { base: "do", past: "did", participle: "done", pt: "fazer" },
  { base: "drive", past: "drove", participle: "driven", pt: "dirigir" },
  { base: "feel", past: "felt", participle: "felt", pt: "sentir" },
  { base: "find", past: "found", participle: "found", pt: "encontrar" },
  { base: "get", past: "got", participle: "gotten", pt: "obter / ficar" },
  { base: "give", past: "gave", participle: "given", pt: "dar" },
  { base: "go", past: "went", participle: "gone", pt: "ir" },
  { base: "grow", past: "grew", participle: "grown", pt: "crescer" },
  { base: "have", past: "had", participle: "had", pt: "ter" },
  { base: "hear", past: "heard", participle: "heard", pt: "ouvir" },
  { base: "keep", past: "kept", participle: "kept", pt: "manter" },
  { base: "know", past: "knew", participle: "known", pt: "saber / conhecer" },
  { base: "leave", past: "left", participle: "left", pt: "sair / deixar" },
  { base: "lose", past: "lost", participle: "lost", pt: "perder" },
  { base: "make", past: "made", participle: "made", pt: "fazer" },
  { base: "meet", past: "met", participle: "met", pt: "encontrar-se" },
  { base: "pay", past: "paid", participle: "paid", pt: "pagar" },
  { base: "put", past: "put", participle: "put", pt: "colocar" },
  { base: "read", past: "read", participle: "read", pt: "ler" },
  { base: "run", past: "ran", participle: "run", pt: "correr" },
  { base: "say", past: "said", participle: "said", pt: "dizer" },
  { base: "see", past: "saw", participle: "seen", pt: "ver" },
  { base: "sell", past: "sold", participle: "sold", pt: "vender" },
  { base: "send", past: "sent", participle: "sent", pt: "enviar" },
  { base: "show", past: "showed", participle: "shown", pt: "mostrar" },
  { base: "speak", past: "spoke", participle: "spoken", pt: "falar" },
  { base: "spend", past: "spent", participle: "spent", pt: "gastar" },
  { base: "take", past: "took", participle: "taken", pt: "pegar / levar" },
  { base: "teach", past: "taught", participle: "taught", pt: "ensinar" },
  { base: "tell", past: "told", participle: "told", pt: "contar" },
  { base: "think", past: "thought", participle: "thought", pt: "pensar" },
  { base: "understand", past: "understood", participle: "understood", pt: "entender" },
  { base: "write", past: "wrote", participle: "written", pt: "escrever" },
];

const PARTICLES = [
  "up", "out", "on", "off", "in", "into", "over", "down", "back", "away", "through", "along", "around", "forward",
];

const PHRASAL_MEANINGS: Record<string, string> = {
  "bring up": "mencionar um assunto",
  "carry out": "executar, realizar",
  "catch up": "colocar em dia",
  "come up": "surgir",
  "figure out": "descobrir, entender",
  "fill in": "preencher",
  "find out": "descobrir",
  "follow up": "dar seguimento",
  "get along": "se dar bem",
  "give up": "desistir",
  "go over": "revisar",
  "hand in": "entregar",
  "hold on": "esperar",
  "look forward": "estar ansioso por",
  "look into": "investigar",
  "look up": "procurar (informação)",
  "point out": "apontar, destacar",
  "put off": "adiar",
  "reach out": "entrar em contato",
  "run out": "acabar (estoque)",
  "set up": "configurar, organizar",
  "sort out": "resolver",
  "speak up": "falar mais alto",
  "sum up": "resumir",
  "take on": "assumir",
  "turn down": "recusar",
  "work out": "dar certo / resolver",
  "wrap up": "concluir",
};

/** Connectors that make speaking and writing sound organised. */
const LINKING_WORDS: Record<string, string> = {
  however: "no entanto",
  therefore: "portanto",
  moreover: "além disso",
  besides: "além disso",
  although: "embora",
  though: "embora / porém",
  because: "porque",
  "so that": "para que",
  "in addition": "além disso",
  "for example": "por exemplo",
  "for instance": "por exemplo",
  "on the other hand": "por outro lado",
  "as a result": "como resultado",
  "in fact": "na verdade",
  finally: "finalmente",
  meanwhile: "enquanto isso",
  otherwise: "caso contrário",
  instead: "em vez disso",
  "even though": "mesmo que",
  "in short": "em resumo",
  first: "primeiro",
  "at the same time": "ao mesmo tempo",
  "of course": "claro",
  actually: "na verdade",
};

/** Finds linking words (connectors) present in the given text. */
export function findLinkingWords(text: string, limit = 12): { word: string; pt: string }[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s']/g, " ").replace(/\s+/g, " ")} `;
  const out: { word: string; pt: string }[] = [];
  for (const [word, pt] of Object.entries(LINKING_WORDS)) {
    if (lower.includes(` ${word} `)) out.push({ word, pt });
    if (out.length >= limit) break;
  }
  return out;
}

/** Core study lists, used when the lesson content has no example yet. */
export function essentialLinkingWords(limit = 12) {
  return Object.entries(LINKING_WORDS)
    .slice(0, limit)
    .map(([word, pt]) => ({ word, pt }));
}

export function essentialIrregularVerbs(limit = 20): Irregular[] {
  return IRREGULARS.slice(0, limit);
}

export function essentialPhrasalVerbs(limit = 16) {
  return Object.entries(PHRASAL_MEANINGS)
    .slice(0, limit)
    .map(([phrase, pt]) => ({ phrase, pt }));
}

/** Finds irregular verbs (any form) present in the given text. */
export function findIrregularVerbs(text: string, limit = 12): Irregular[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s']/g, " ").replace(/\s+/g, " ")} `;
  const found: Irregular[] = [];
  for (const verb of IRREGULARS) {
    const forms = [verb.base, ...verb.past.split("/"), verb.participle];
    if (forms.some((f) => lower.includes(` ${f} `))) found.push(verb);
    if (found.length >= limit) break;
  }
  return found;
}

/** Finds phrasal verbs (verb + particle) present in the given text. */
export function findPhrasalVerbs(text: string, limit = 10): { phrase: string; pt: string }[] {
  const words = text.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter(Boolean);
  const seen = new Map<string, string>();
  for (let i = 0; i < words.length - 1; i += 1) {
    const pair = `${words[i]} ${words[i + 1]}`;
    if (!PARTICLES.includes(words[i + 1]!)) continue;
    if (PHRASAL_MEANINGS[pair]) seen.set(pair, PHRASAL_MEANINGS[pair]!);
  }
  return [...seen.entries()].slice(0, limit).map(([phrase, pt]) => ({ phrase, pt }));
}

/** Builds linking-sound examples from real word pairs in the text. */
export function findLinkingSounds(text: string, limit = 8): { pair: string; tip: string }[] {
  const vowels = "aeiou";
  const words = text
    .replace(/[^A-Za-z\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const out: { pair: string; tip: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < words.length - 1; i += 1) {
    const a = words[i]!.toLowerCase();
    const b = words[i + 1]!.toLowerCase();
    const last = a[a.length - 1]!;
    const first = b[0]!;
    const key = `${a} ${b}`;
    if (seen.has(key)) continue;

    let tip: string | null = null;
    if (!vowels.includes(last) && vowels.includes(first)) {
      tip = `consonant + vowel: say "${a.slice(0, -1)}-${last}${b}" as one block`;
    } else if (vowels.includes(last) && vowels.includes(first)) {
      const glide = "ouw".includes(last) ? "w" : "y";
      tip = `vowel + vowel: add a soft /${glide}/ between them`;
    } else if (last === first && !vowels.includes(last)) {
      tip = `same consonant: hold one single /${last}/ sound`;
    }

    if (tip) {
      seen.add(key);
      out.push({ pair: `${a} ${b}`, tip });
      if (out.length >= limit) break;
    }
  }
  return out;
}

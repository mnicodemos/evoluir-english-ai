/**
 * Groups the streamed reply into speech blocks.
 *
 * Every block costs one audio request, so short phrases are merged and a cut is
 * only made once a block is long enough to be worth its own request. The cut
 * always happens on a natural pause, so the voice never breaks mid-clause.
 */
export const MIN_SPEECH_BLOCK_CHARS = 140;

const PAUSE = /[.!?,;](?:\s|$)/g;

export function takeSpeechBlocks(
  value: string,
  minChars = MIN_SPEECH_BLOCK_CHARS,
): { blocks: string[]; rest: string } {
  const blocks: string[] = [];
  let rest = value;

  while (true) {
    PAUSE.lastIndex = 0;
    let cut = -1;
    let match: RegExpExecArray | null;
    while ((match = PAUSE.exec(rest)) !== null) {
      const end = match.index + match[0].length;
      if (end >= minChars) {
        cut = end;
        break;
      }
    }
    if (cut < 0) break;
    const block = rest.slice(0, cut).trim();
    if (block) blocks.push(block);
    rest = rest.slice(cut);
  }

  return { blocks, rest };
}

/**
 * Splits one spoken answer so the first sound starts earlier.
 *
 * Generation time grows with the length of the text, so a long answer is cut
 * into a short opening block plus larger following blocks. The cut always
 * happens on a natural pause and the order is preserved, so the voice sounds
 * the same as before — only the waiting is shorter.
 */
export const FIRST_BLOCK_MAX_CHARS = 120;
export const FOLLOWING_BLOCK_MIN_CHARS = 220;
/** Keeps one spoken answer from turning into many small audio requests. */
export const MAX_SPEECH_BLOCKS = 4;

function cutAtPause(value: string, minChars: number, maxChars: number): number {
  PAUSE.lastIndex = 0;
  let best = -1;
  let match: RegExpExecArray | null;
  while ((match = PAUSE.exec(value)) !== null) {
    const end = match.index + match[0].length;
    if (end < minChars) continue;
    if (end > maxChars && best > 0) break;
    best = end;
    if (end >= minChars) break;
  }
  return best;
}

export function splitForFirstAudio(
  value: string,
  firstMax = FIRST_BLOCK_MAX_CHARS,
  followingMin = FOLLOWING_BLOCK_MIN_CHARS,
  maxBlocks = MAX_SPEECH_BLOCKS,
): string[] {
  const text = value.trim();
  if (!text) return [];
  // Short answers are already fast: one request keeps the voice seamless.
  if (text.length <= firstMax + 40) return [text];

  const blocks: string[] = [];
  let rest = text;
  const firstCut = cutAtPause(rest, 30, firstMax);
  if (firstCut > 0) {
    blocks.push(rest.slice(0, firstCut).trim());
    rest = rest.slice(firstCut).trim();
  }

  while (rest.length > followingMin + 60 && blocks.length < maxBlocks - 1) {
    const cut = cutAtPause(rest, followingMin, followingMin * 2);
    if (cut <= 0) break;
    blocks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) blocks.push(rest);
  return blocks.filter((block) => block.length > 0);
}

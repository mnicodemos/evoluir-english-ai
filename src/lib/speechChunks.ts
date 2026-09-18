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

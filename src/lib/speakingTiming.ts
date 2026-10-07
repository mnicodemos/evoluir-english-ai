// How long a student waits for EVO after answering in AI Speaking. The browser
// marks each stage of one answer; the Admin summarises the saved rows.

export type TurnMarks = {
  /** The student tapped to stop recording. */
  stoppedAt: number;
  transcribedAt?: number;
  firstTextAt?: number;
  firstAudioAt?: number;
};

export type TurnTimingRow = {
  transcribe_ms: number | null;
  first_text_ms: number | null;
  first_audio_ms: number | null;
};

const MAX_MS = 120_000;

function since(start: number, mark: number | undefined) {
  if (mark === undefined) return null;
  const ms = Math.round(mark - start);
  return ms >= 0 && ms <= MAX_MS ? ms : null;
}

/** One row per answer; null when the answer never reached the first sound. */
export function turnTimingRow(marks: TurnMarks): TurnTimingRow | null {
  const row = {
    transcribe_ms: since(marks.stoppedAt, marks.transcribedAt),
    first_text_ms: since(marks.stoppedAt, marks.firstTextAt),
    first_audio_ms: since(marks.stoppedAt, marks.firstAudioAt),
  };
  return row.first_audio_ms === null ? null : row;
}

export type StageSummary = { medianMs: number | null; p90Ms: number | null };

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

function stage(rows: TurnTimingRow[], key: keyof TurnTimingRow): StageSummary {
  const values = rows.map((row) => row[key]).filter((v): v is number => typeof v === "number");
  return { medianMs: percentile(values, 50), p90Ms: percentile(values, 90) };
}

/** Median and slowest-10% wait per stage, all measured from the end of the answer. */
export function speakingWaitSummary(rows: TurnTimingRow[]) {
  return {
    answers: rows.length,
    transcribed: stage(rows, "transcribe_ms"),
    firstText: stage(rows, "first_text_ms"),
    firstAudio: stage(rows, "first_audio_ms"),
  };
}

// Browser speech recognition for single-word pronunciation checks.
// Runs alongside the WAV recorder; when it yields a transcript the AI
// transcription is skipped (instant, no credits). Otherwise the caller falls
// back to the existing transcription with the recorded audio.

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => Recognition;

let active: {
  recognition: Recognition;
  text: string;
  error: string | null;
  done: Promise<void>;
} | null = null;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserRecognitionAvailable(): boolean {
  return ctor() !== null;
}

export function startBrowserRecognition(): boolean {
  cancelBrowserRecognition();
  const Ctor = ctor();
  if (!Ctor) return false;
  try {
    const recognition = new Ctor();
    recognition.lang = "en-US";
    // Keep the session alive while the student speaks. On mobile Chrome a
    // one-shot session can close during the pause between tapping and speaking.
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    let finish: () => void = () => {};
    const done = new Promise<void>((resolve) => (finish = resolve));
    const state = { recognition, text: "", error: null, done };
    recognition.onresult = (event) => {
      state.text = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
    };
    recognition.onend = () => finish();
    recognition.onerror = (event) => {
      state.error = event.error ?? "recognition_failed";
      finish();
    };
    recognition.start();
    active = state;
    return true;
  } catch {
    active = null;
    return false;
  }
}

/** Stops listening and returns the transcript, or null if none was heard. */
export async function stopBrowserRecognition(timeoutMs = 2500): Promise<string | null> {
  const state = active;
  active = null;
  if (!state) return null;
  try {
    state.recognition.stop();
  } catch {
    /* already stopped */
  }
  await Promise.race([state.done, new Promise((r) => setTimeout(r, timeoutMs))]);
  return state.error ? null : state.text || null;
}

export function cancelBrowserRecognition(): void {
  const state = active;
  active = null;
  try {
    state?.recognition.abort();
  } catch {
    /* ignore */
  }
}

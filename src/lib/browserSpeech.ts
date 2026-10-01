// Browser speech recognition for single-word pronunciation checks.
// Kept to short Vocabulary attempts because mobile browser support is limited
// and longer Listening Lab sentences need the complete WAV recording.

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
  stopping: boolean;
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
    const state: NonNullable<typeof active> = {
      recognition,
      text: "",
      error: null,
      stopping: false,
      done,
    };
    // Some mobile browsers (Samsung Internet) close the session on their own
    // after a short silence, before the student speaks. While the student is
    // still recording, the session is reopened so the word is not lost.
    let heard = "";
    let restarts = 0;
    recognition.onresult = (event) => {
      const current = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      state.text = [heard, current].filter(Boolean).join(" ").trim();
    };
    recognition.onend = () => {
      if (!state.stopping && active === state && restarts < 20) {
        restarts++;
        heard = state.text;
        try {
          recognition.start();
          return;
        } catch {
          /* fall through */
        }
      }
      finish();
    };
    recognition.onerror = (event) => {
      const code = event.error ?? "recognition_failed";
      // Silence and early-close errors are followed by onend, which restarts.
      if (!state.stopping && (code === "no-speech" || code === "aborted" || code === "network"))
        return;
      state.error = code;
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
  state.stopping = true;
  try {
    state.recognition.stop();
  } catch {
    /* already stopped */
  }
  await Promise.race([state.done, new Promise((r) => setTimeout(r, timeoutMs))]);
  // Chrome can report an end error after already delivering a usable interim
  // result. Preserve what was heard instead of discarding valid speech.
  return state.text || null;
}

export function cancelBrowserRecognition(): void {
  const state = active;
  active = null;
  if (state) state.stopping = true;
  try {
    state?.recognition.abort();
  } catch {
    /* ignore */
  }
}

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Headphones,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Repeat,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { listeningLevelConfig } from "@/lib/listeningLevels";
import { loadLessonPodcast } from "@/lib/reviewPodcast.functions";
import { afterPodcastLine, PODCAST_SPEAKERS } from "@/lib/reviewPodcast";
import { prepareSpeech, speakEnglish, stopSpeaking } from "@/lib/speech";
import { transcribeAudio } from "@/lib/transcribe";
import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
} from "@/lib/voice-recorder";
import { cn } from "@/lib/utils";

function readPodcastPosition(lessonId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(`lesson-podcast-position:${lessonId}`));
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Listener choices kept on this device: a slower voice and a pause to repeat each line. */
const SLOW_KEY = "evoluir-podcast-slow";
const SHADOW_KEY = "evoluir-podcast-shadow";

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function saveFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Blocked storage: the choice lasts until the page closes.
  }
}

const MARK_TONE = {
  mistake: "bg-destructive/15 text-destructive ring-destructive/40",
  correction: "bg-brand-green/15 text-brand-green ring-brand-green/40",
} as const;

const SPEAKER_TONE = {
  evo: "bg-brand-green/15 text-brand-green ring-brand-green/35",
  leo: "bg-sky-400/15 text-sky-300 ring-sky-400/35",
} as const;

/**
 * Lesson audio dialogue: EVO and Leo speak in their own voices, line by line,
 * with the current line highlighted and Portuguese translation available on
 * request. Listening to the end completes the lesson's media step; while it
 * plays, the activity clock keeps running (data-media-playing).
 */
export function LessonPodcast({
  lessonId,
  level,
  progress,
  onProgress,
  t,
  compact = false,
}: {
  lessonId: string;
  level: string;
  progress: number;
  onProgress: (percent: number) => void;
  t: (text: string) => string;
  compact?: boolean;
}) {
  const load = useServerFn(loadLessonPodcast);
  const query = useQuery({
    queryKey: ["lesson-podcast", lessonId],
    queryFn: () => load({ data: { lessonId } }),
    staleTime: Infinity,
    retry: false,
  });
  const lines = query.data?.lines ?? [];
  const [current, setCurrent] = useState(() => readPodcastPosition(lessonId));
  const [playing, setPlaying] = useState(false);
  const [showPt, setShowPt] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const run = useRef(0);
  const listRef = useRef<HTMLOListElement>(null);
  const reported = useRef(progress);
  // A little slower for beginners, like the Listening Lab; 0.8× on request.
  const [slow, setSlow] = useState(false);
  // Shadowing: a pause after each line to repeat it out loud.
  const [shadow, setShadow] = useState(false);
  useEffect(() => {
    setSlow(readFlag(SLOW_KEY));
    setShadow(readFlag(SHADOW_KEY));
  }, []);
  const rate = Math.max(0.85, listeningLevelConfig(level).rate) * (slow ? 0.8 : 1);
  // The challenge line waiting for the listener's answer ("Your turn").
  const [turn, setTurn] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [checking, setChecking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);

  // Persist the active line per lesson so the progress bar and Play control
  // agree after leaving the page and returning later.
  useEffect(() => {
    try {
      window.localStorage.setItem(`lesson-podcast-position:${lessonId}`, String(current));
    } catch {
      // Storage can be unavailable in private browsing; playback still works.
    }
  }, [current, lessonId]);

  useEffect(
    () => () => {
      run.current += 1;
      stopSpeaking();
      cancelVoiceRecording();
    },
    [],
  );

  // Keeps the line being spoken in view inside the list, never the page.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[current] as HTMLElement | undefined;
    if (!list || !item) return;
    list.scrollTo({ top: item.offsetTop - list.offsetTop - 8, behavior: "smooth" });
  }, [current]);

  /** Plays from a line to the end, or only that line (single, the ↻ button). */
  async function playFrom(start: number, single = false) {
    const id = ++run.current;
    setPlaybackError(null);
    setTurn(null);
    setSaid(null);
    setTurnError(null);
    setPlaying(true);
    for (let index = start; index < lines.length; index += 1) {
      if (run.current !== id) return;
      setCurrent(index);
      const line = lines[index]!;
      const next = lines[index + 1];
      // The next line is prepared only once this one is playing (owner report,
      // 2026-10-30: the dialogue stalled). Asked before, it took the student's
      // one voice request first, and this line waited behind it.
      const speakLine = () =>
        speakEnglish(line.text, {
          cache: "persistent",
          rate,
          voice: PODCAST_SPEAKERS[line.speaker].voice,
          // Only EVO's and Leo's voices: never the device's robotic one.
          browserFallback: false,
          onStart: () => {
            if (!next || single || run.current !== id) return;
            prepareSpeech(next.text, {
              cache: "persistent",
              voice: PODCAST_SPEAKERS[next.speaker].voice,
            });
          },
        });
      try {
        try {
          await speakLine();
        } catch {
          // One more try after a short pause before the student sees an error.
          if (run.current !== id) return;
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          if (run.current !== id) return;
          await speakLine();
        }
      } catch (error) {
        if (run.current !== id) return;
        setPlaybackError(
          error instanceof Error
            ? error.message
            : "This line could not be played. Check your connection and try again.",
        );
        setPlaying(false);
        return;
      }
      if (run.current !== id) return;
      // The media step moves in quarters, so its saved progress is not written per line.
      const percent = Math.floor(((index + 1) / lines.length) * 4) * 25;
      if (percent > reported.current) {
        reported.current = percent;
        onProgress(percent);
      }
      if (single) break;
      // The challenge waits for the listener (owner request, 2026-10-30: the
      // model answer used to follow at once, so nobody answered).
      const after = afterPodcastLine(line, !!next, shadow);
      if (after.kind === "turn") {
        setTurn(index);
        setPlaying(false);
        return;
      }
      if (after.kind === "pause") {
        await new Promise((resolve) => setTimeout(resolve, after.ms));
        if (run.current !== id) return;
      }
    }
    if (run.current === id) setPlaying(false);
  }

  async function toggleRecording() {
    setTurnError(null);
    if (!recording) {
      try {
        await startVoiceRecording();
        setSaid(null);
        setRecording(true);
      } catch (error) {
        setTurnError(error instanceof Error ? error.message : "Microphone unavailable.");
      }
      return;
    }
    setRecording(false);
    setChecking(true);
    try {
      const blob = await stopVoiceRecording();
      const text = (await transcribeAudio(blob)).trim();
      setSaid(text || null);
      if (!text) setTurnError(t("We could not hear you. Try again or listen to the model answer."));
    } catch (error) {
      setTurnError(error instanceof Error ? error.message : "Your answer could not be checked.");
    } finally {
      setChecking(false);
    }
  }

  function continueAfterTurn() {
    if (turn === null) return;
    if (recording) {
      cancelVoiceRecording();
      setRecording(false);
    }
    void playFrom(turn + 1);
  }

  function pause() {
    run.current += 1;
    stopSpeaking();
    setPlaying(false);
  }

  function toggleSlow() {
    setSlow((value) => {
      saveFlag(SLOW_KEY, !value);
      return !value;
    });
  }

  function toggleShadow() {
    setShadow((value) => {
      saveFlag(SHADOW_KEY, !value);
      return !value;
    });
  }

  if (query.isPending) {
    return (
      <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
        <Loader2 className="size-6 animate-spin text-brand-green" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {t("EVO and Leo are preparing your lesson audio…")}
        </p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
        <Headphones className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {t(
            "The lesson audio could not be prepared right now. Read the summary below and continue the lesson.",
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
            <RotateCcw className="size-4" aria-hidden="true" /> {t("Try again")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onProgress(100)}>
            {t("Mark this part as done")}
          </Button>
        </div>
      </div>
    );
  }

  const done = !playing && progress >= 100;

  return (
    <section
      className={cn("card-soft space-y-4 p-4 sm:p-5", compact && "space-y-3 p-3 sm:p-4")}
      data-media-playing={playing ? "true" : "false"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 items-center gap-3 sm:flex-1">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-green/15 text-brand-green ring-1 ring-brand-green/30">
            <Headphones className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-green">
              {t("Lesson audio")}
            </p>
            <p className="truncate font-display text-base font-semibold" translate="no">
              {query.data.title}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Button
            className="min-w-0 flex-1 sm:flex-none"
            size="sm"
            variant="outline"
            onClick={() => setShowPt((value) => !value)}
            aria-pressed={showPt}
          >
            <Languages className="size-4 shrink-0" aria-hidden="true" />
            {showPt ? t("Hide translation") : t("Show translation")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn("tabular-nums", slow && "border-brand-green text-brand-green")}
            aria-pressed={slow}
            aria-label={t("Slower voice")}
            title={t("Slower voice")}
            onClick={toggleSlow}
          >
            0.8×
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(shadow && "border-brand-green text-brand-green")}
            aria-pressed={shadow}
            title={t("A pause after each line to repeat it out loud")}
            onClick={toggleShadow}
          >
            <Repeat className="size-4 shrink-0" aria-hidden="true" /> {t("Repeat after")}
          </Button>
          {playing ? (
            <Button className="min-w-0 flex-1 sm:flex-none" size="sm" onClick={pause}>
              <Pause className="size-4 shrink-0" aria-hidden="true" /> {t("Pause")}
            </Button>
          ) : (
            <Button
              className="min-w-0 flex-1 sm:flex-none"
              size="sm"
              onClick={() =>
                turn !== null
                  ? continueAfterTurn()
                  : void playFrom(done ? 0 : Math.min(current, Math.max(0, lines.length - 1)))
              }
            >
              {done ? (
                <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Play className="size-4 shrink-0" aria-hidden="true" />
              )}
              {done ? t("Listen again") : current > 0 ? t("Continue") : t("Play audio")}
            </Button>
          )}
        </div>
      </div>

      {playbackError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          <p className="text-destructive">
            {t("Audio could not be played")}: {playbackError}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t("Your progress was not advanced. Press Continue to retry this line.")}
          </p>
        </div>
      ) : null}

      {turn !== null ? (
        <div
          className="rounded-xl border border-amber-400/40 bg-amber-400/[0.07] p-3 sm:p-4"
          role="status"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400">
            {t("Your turn")}
          </p>
          <p className="mt-1 text-sm" translate="no" lang="en">
            {lines[turn]?.text}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "Answer out loud. You can record it to see what you said, then hear EVO's model answer.",
            )}
          </p>
          {said ? (
            <p className="mt-2 rounded-lg bg-white/[0.05] px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">{t("You said")}:</span>{" "}
              <span translate="no" lang="en">
                {said}
              </span>
            </p>
          ) : null}
          {turnError ? <p className="mt-2 text-xs text-destructive">{turnError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={recording ? "default" : "outline"}
              disabled={checking}
              onClick={() => void toggleRecording()}
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : recording ? (
                <MicOff className="size-4" aria-hidden="true" />
              ) : (
                <Mic className="size-4" aria-hidden="true" />
              )}
              {checking
                ? t("Checking...")
                : recording
                  ? t("Stop recording")
                  : said
                    ? t("Record again")
                    : t("Record my answer")}
            </Button>
            <Button size="sm" disabled={checking} onClick={continueAfterTurn}>
              <Play className="size-4" aria-hidden="true" /> {t("Hear the model answer")}
            </Button>
          </div>
        </div>
      ) : null}

      <Progress
        value={
          playbackError
            ? progress
            : Math.max(progress, lines.length ? (current / lines.length) * 100 : 0)
        }
        className="h-1.5"
      />

      <ol
        ref={listRef}
        className={cn("max-h-80 space-y-2 overflow-y-auto pr-1", compact && "max-h-64 space-y-1.5")}
        translate="no"
      >
        {lines.map((line, index) => (
          <li key={index} className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => void playFrom(index)}
              className={cn(
                "flex min-w-0 flex-1 gap-3 rounded-lg p-2 text-left transition-colors",
                index === current && (playing || current > 0 || turn !== null)
                  ? "bg-white/[0.06] ring-1 ring-inset ring-white/10"
                  : "hover:bg-white/[0.03]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 h-fit w-11 shrink-0 rounded-full py-0.5 text-center text-[10px] font-semibold ring-1 ring-inset",
                  SPEAKER_TONE[line.speaker],
                )}
              >
                {PODCAST_SPEAKERS[line.speaker].name}
              </span>
              <span className="min-w-0 space-y-0.5">
                {line.mark === "mistake" || line.mark === "correction" ? (
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                      MARK_TONE[line.mark],
                    )}
                    translate="yes"
                  >
                    {line.mark === "mistake" ? t("Common mistake") : t("Correction")}
                  </span>
                ) : null}
                <span className="block text-sm leading-relaxed">{line.text}</span>
                {showPt && <span className="block text-xs text-muted-foreground">{line.pt}</span>}
              </span>
            </button>
            {/* Hear only this line again (owner request, 2026-10-30). */}
            <button
              type="button"
              className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
              aria-label={t("Hear this line again")}
              title={t("Hear this line again")}
              onClick={() => void playFrom(index, true)}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

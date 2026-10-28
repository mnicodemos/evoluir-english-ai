import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, Languages, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { listeningLevelConfig } from "@/lib/listeningLevels";
import { loadLessonPodcast } from "@/lib/reviewPodcast.functions";
import { PODCAST_SPEAKERS } from "@/lib/reviewPodcast";
import { prepareSpeech, speakEnglish, stopSpeaking } from "@/lib/speech";
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
  // A little slower for beginners, like the Listening Lab.
  const rate = Math.max(0.85, listeningLevelConfig(level).rate);

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

  async function playFrom(start: number) {
    const id = ++run.current;
    setPlaybackError(null);
    setPlaying(true);
    for (let index = start; index < lines.length; index += 1) {
      if (run.current !== id) return;
      setCurrent(index);
      const line = lines[index]!;
      const next = lines[index + 1];
      if (next) {
        prepareSpeech(next.text, {
          cache: "persistent",
          voice: PODCAST_SPEAKERS[next.speaker].voice,
        });
      }
      try {
        await speakEnglish(line.text, {
          cache: "persistent",
          rate,
          voice: PODCAST_SPEAKERS[line.speaker].voice,
        });
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
    }
    if (run.current === id) setPlaying(false);
  }

  function pause() {
    run.current += 1;
    stopSpeaking();
    setPlaying(false);
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
          {playing ? (
            <Button className="min-w-0 flex-1 sm:flex-none" size="sm" onClick={pause}>
              <Pause className="size-4 shrink-0" aria-hidden="true" /> {t("Pause")}
            </Button>
          ) : (
            <Button
              className="min-w-0 flex-1 sm:flex-none"
              size="sm"
              onClick={() =>
                void playFrom(done ? 0 : Math.min(current, Math.max(0, lines.length - 1)))
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

      <Progress
        value={playbackError ? progress : Math.max(progress, lines.length ? (current / lines.length) * 100 : 0)}
        className="h-1.5"
      />

      <ol
        ref={listRef}
        className={cn("max-h-80 space-y-2 overflow-y-auto pr-1", compact && "max-h-64 space-y-1.5")}
        translate="no"
      >
        {lines.map((line, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => void playFrom(index)}
              className={cn(
                "flex w-full gap-3 rounded-lg p-2 text-left transition-colors",
                index === current && (playing || current > 0)
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
                <span className="block text-sm leading-relaxed">{line.text}</span>
                {showPt && <span className="block text-xs text-muted-foreground">{line.pt}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

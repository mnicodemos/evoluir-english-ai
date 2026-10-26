import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, Languages, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { listeningLevelConfig } from "@/lib/listeningLevels";
import { loadReviewPodcast } from "@/lib/reviewPodcast.functions";
import { PODCAST_SPEAKERS } from "@/lib/reviewPodcast";
import { prepareSpeech, speakEnglish, stopSpeaking } from "@/lib/speech";
import { cn } from "@/lib/utils";

const SPEAKER_TONE = {
  evo: "bg-brand-green/15 text-brand-green ring-brand-green/35",
  leo: "bg-sky-400/15 text-sky-300 ring-sky-400/35",
} as const;

/**
 * The review lessons' podcast (owner request, 2026-10-26): EVO and her co-host
 * Leo talk through the units under review, each in their own voice, line by
 * line, with the line being spoken highlighted and its Portuguese on request.
 * Listening to the end counts as the lesson's video step; while it plays the
 * activity clock keeps running (data-media-playing).
 */
export function ReviewPodcast({
  lessonId,
  level,
  progress,
  onProgress,
}: {
  lessonId: string;
  level: string;
  progress: number;
  onProgress: (percent: number) => void;
}) {
  const load = useServerFn(loadReviewPodcast);
  const query = useQuery({
    queryKey: ["review-podcast", lessonId],
    queryFn: () => load({ data: { lessonId } }),
    staleTime: Infinity,
    retry: false,
  });
  const lines = query.data?.lines ?? [];
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showPt, setShowPt] = useState(false);
  const run = useRef(0);
  const listRef = useRef<HTMLOListElement>(null);
  const reported = useRef(progress);
  // A little slower for beginners, like the Listening Lab.
  const rate = Math.max(0.85, listeningLevelConfig(level).rate);

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
      } catch {
        // One line that could not play does not stop the episode.
      }
      if (run.current !== id) return;
      // The video step moves in quarters, so its saved progress is not written per line.
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
        <p className="text-sm text-muted-foreground">EVO and Leo are recording your episode…</p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
        <Headphones className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          The podcast could not be prepared right now. Read the summary below and continue the
          lesson.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>
            <RotateCcw className="size-4" aria-hidden="true" /> Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onProgress(100)}>
            Mark this part as done
          </Button>
        </div>
      </div>
    );
  }

  const done = !playing && progress >= 100;

  return (
    <section
      className="card-soft space-y-4 p-4 sm:p-5"
      data-media-playing={playing ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-green/15 text-brand-green ring-1 ring-brand-green/30">
          <Headphones className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-green">
            Episode
          </p>
          <p className="truncate font-display text-base font-semibold" translate="no">
            {query.data.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPt((value) => !value)}
            aria-pressed={showPt}
          >
            <Languages className="size-4" aria-hidden="true" />
            {showPt ? "Hide translation" : "Show translation"}
          </Button>
          {playing ? (
            <Button size="sm" onClick={pause}>
              <Pause className="size-4" aria-hidden="true" /> Pause
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void playFrom(done || current >= lines.length - 1 ? 0 : current)}
            >
              {done ? (
                <RotateCcw className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              {done ? "Listen again" : current > 0 ? "Continue" : "Play episode"}
            </Button>
          )}
        </div>
      </div>

      <Progress
        value={Math.max(progress, lines.length ? (current / lines.length) * 100 : 0)}
        className="h-1.5"
      />

      <ol ref={listRef} className="max-h-80 space-y-2 overflow-y-auto pr-1" translate="no">
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

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isPlayableVideoUrl, youtubeVideoId } from "@/lib/lessonVideoDisplay";

const speeds = [0.75, 1, 1.25, 1.5];

/**
 * Responsive lesson player. Plays a direct video file with speed control and
 * progress tracking, or embeds a YouTube video with a manual completion button.
 */
export function LessonVideo({
  url,
  progress,
  onProgress,
  captions,
}: {
  url: string | null;
  progress: number;
  onProgress: (percent: number) => void;
  captions?: { label: string; src: string }[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const lastSent = useRef(progress);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  if (!url || !isPlayableVideoUrl(url)) {
    return (
      <div className="card-soft flex flex-col items-center gap-3 p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-secondary">
          <Play className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">
          {url
            ? "This video is unavailable right now. Read the summary below and continue the lesson."
            : "No video has been added to this lesson yet. Read the summary and transcript below, then continue to the flashcards."}
        </p>
        <Button size="sm" variant="secondary" onClick={() => onProgress(100)}>
          Mark this part as done
        </Button>
        <Progress value={progress} className="mt-1 h-2 w-full" />
      </div>
    );
  }

  const yt = youtubeVideoId(url);
  if (yt) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl bg-black">
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube.com/embed/${yt}?cc_load_policy=1`}
            title="Lesson video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onProgress(100)}
            disabled={progress >= 100}
          >
            {progress >= 100 ? "Watched" : "I watched it"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        className="w-full rounded-xl bg-black"
        controls
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (!el.duration) return;
          const percent = (el.currentTime / el.duration) * 100;
          if (percent - lastSent.current >= 5) {
            lastSent.current = percent;
            onProgress(Math.min(percent, 98));
          }
        }}
        onEnded={() => {
          lastSent.current = 100;
          onProgress(100);
        }}
      >
        <source src={url} />
        {captions?.map((c) => (
          <track
            key={c.label}
            kind="subtitles"
            label={c.label}
            src={c.src}
            srcLang={c.label.slice(0, 2)}
          />
        ))}
      </video>

      <div className="flex flex-wrap items-center gap-3">
        <Progress value={progress} className="h-2 min-w-32 flex-1" />
        <span className="text-xs text-muted-foreground">{Math.round(progress)}% watched</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onProgress(100)}
          disabled={progress >= 100}
        >
          {progress >= 100 ? "Watched" : "I watched it"}
        </Button>
        <div className="flex items-center gap-1">
          {speeds.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                speed === s
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

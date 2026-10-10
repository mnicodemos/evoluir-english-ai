import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isPlayableVideoUrl, youtubeVideoId } from "@/lib/lessonVideoDisplay";
import { readStorage, writeStorage } from "@/lib/safeStorage";

const speeds = [0.75, 1, 1.25, 1.5];

/** Where the student stopped, per lesson and video (user request): switching
 *  to another tab of the lesson, or leaving and coming back, resumes there. */
function positionKey(resumeKey: string, url: string) {
  return `lesson-video-position:${resumeKey}:${url}`;
}

function readPosition(resumeKey: string | undefined, url: string): number {
  if (!resumeKey) return 0;
  const seconds = Number(readStorage(positionKey(resumeKey, url)) ?? 0);
  return Number.isFinite(seconds) && seconds > 3 ? Math.floor(seconds) : 0;
}

function savePosition(resumeKey: string | undefined, url: string, seconds: number, ended = false) {
  if (!resumeKey) return;
  // A video watched to the end starts again from the beginning next time.
  writeStorage(positionKey(resumeKey, url), String(ended ? 0 : Math.floor(seconds)));
}

/**
 * YouTube embed that remembers where the student stopped. It uses the embed's
 * own message channel (enablejsapi), so no extra script is loaded: the player
 * reports its time, which is saved and given back as the start time.
 */
function YouTubeLessonVideo({
  id,
  url,
  resumeKey,
  progress,
  onProgress,
}: {
  id: string;
  url: string;
  resumeKey?: string | undefined;
  progress: number;
  onProgress: (percent: number) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [start] = useState(() => readPosition(resumeKey, url));
  const lastSent = useRef(progress);
  const lastSaved = useRef(0);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(event.origin)) return;
      let payload: {
        event?: string;
        info?: { currentTime?: number; duration?: number; playerState?: number };
      };
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.event !== "infoDelivery" || !payload.info) return;
      const { currentTime, duration, playerState } = payload.info;
      if (playerState === 0) {
        savePosition(resumeKey, url, 0, true);
        lastSent.current = 100;
        onProgress(100);
        return;
      }
      if (typeof currentTime === "number" && Math.abs(currentTime - lastSaved.current) >= 3) {
        lastSaved.current = currentTime;
        savePosition(resumeKey, url, currentTime);
        if (typeof duration === "number" && duration > 0) {
          const percent = (currentTime / duration) * 100;
          if (percent - lastSent.current >= 5) {
            lastSent.current = percent;
            onProgress(Math.min(percent, 98));
          }
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resumeKey, url, onProgress]);

  function startListening() {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
      "*",
    );
  }

  const params = new URLSearchParams({ cc_load_policy: "1", enablejsapi: "1", rel: "0" });
  if (origin) params.set("origin", origin);
  if (start > 0) params.set("start", String(start));

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-black">
        <iframe
          ref={frameRef}
          className="aspect-video w-full"
          src={`https://www.youtube.com/embed/${id}?${params.toString()}`}
          title="Lesson video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={startListening}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
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

/**
 * Responsive lesson player. Plays a direct video file with speed control and
 * progress tracking, or embeds a YouTube video with a manual completion button.
 */
export function LessonVideo({
  url,
  progress,
  onProgress,
  captions,
  resumeKey,
}: {
  url: string | null;
  progress: number;
  onProgress: (percent: number) => void;
  captions?: { label: string; src: string }[];
  /** Remembers the position per lesson (the lesson id). */
  resumeKey?: string | undefined;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const lastSent = useRef(progress);
  const lastSavedTime = useRef(0);

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
      <YouTubeLessonVideo
        id={yt}
        url={url}
        resumeKey={resumeKey}
        progress={progress}
        onProgress={onProgress}
      />
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
        onLoadedMetadata={(e) => {
          const start = readPosition(resumeKey, url);
          if (start > 0 && start < e.currentTarget.duration - 3)
            e.currentTarget.currentTime = start;
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (!el.duration) return;
          if (Math.abs(el.currentTime - lastSavedTime.current) >= 3) {
            lastSavedTime.current = el.currentTime;
            savePosition(resumeKey, url, el.currentTime);
          }
          const percent = (el.currentTime / el.duration) * 100;
          if (percent - lastSent.current >= 5) {
            lastSent.current = percent;
            onProgress(Math.min(percent, 98));
          }
        }}
        onEnded={() => {
          savePosition(resumeKey, url, 0, true);
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
              className={`min-h-11 min-w-11 rounded-md px-2 py-1 text-xs font-medium transition-colors sm:min-h-8 sm:min-w-0 ${
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

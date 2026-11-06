import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSharedMusicAsset } from "@/lib/admin.functions";

/** Persistent, opt-in soundtrack control shared by English Adventures. */
export function AdventureMusicControl() {
  const getMusic = useServerFn(getSharedMusicAsset);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const query = useQuery({
    queryKey: ["shared-music-asset"],
    queryFn: () => getMusic(),
    retry: false,
    staleTime: 45 * 60 * 1000,
  });

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem("adventures-music-muted") !== "false");
    } catch {
      setMuted(true);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.12;
    audio.muted = muted;
    if (muted) audio.pause();
    else if (started && query.data?.url) void audio.play().catch(() => setMuted(true));
  }, [muted, started, query.data?.url]);

  function toggleMusic() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (!nextMuted) setStarted(true);
    try {
      window.localStorage.setItem("adventures-music-muted", String(nextMuted));
    } catch {
      // Audio control remains usable when browser storage is unavailable.
    }
  }

  return (
    <div className="flex shrink-0 items-center">
      {query.data?.url ? (
        <audio ref={audioRef} src={query.data.url} loop preload="none" />
      ) : null}
      <button
        type="button"
        onClick={toggleMusic}
        disabled={!query.data?.url}
        aria-label={muted ? "Turn adventure music on" : "Mute adventure music"}
        aria-pressed={!muted}
        title={muted ? "Turn music on" : "Mute music"}
        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
      >
        {muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

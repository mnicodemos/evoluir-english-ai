import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music2, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAdventureWelcomeAudio, getSharedMusicAsset } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/** Persistent, opt-in soundtrack control shared by English Adventures. */
export function AdventureMusicControl({ welcomeVoice }: { welcomeVoice: "roberta" | "arabella" }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const getMusic = useServerFn(getSharedMusicAsset);
  const audioRef = useRef<HTMLAudioElement>(null);
  const welcomeSequenceRef = useRef(false);
  const [muted, setMuted] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const getWelcomeAudio = useServerFn(getAdventureWelcomeAudio);
  const welcomeQuery = useQuery({
    queryKey: ["adventure-welcome-audio", welcomeVoice],
    queryFn: () => getWelcomeAudio({ data: { voice: welcomeVoice } }),
    retry: false,
    staleTime: 45 * 60 * 1000,
  });
  const query = useQuery({
    queryKey: ["shared-music-asset"],
    queryFn: () => getMusic(),
    retry: false,
    staleTime: 45 * 60 * 1000,
  });

  useEffect(() => {
    try {
      // Playback must still be confirmed by a user gesture in browsers that block autoplay.
      setMuted(window.localStorage.getItem("adventures-music-muted") !== "false");
    } catch {
      setMuted(true);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || welcomeSequenceRef.current) return;
    audio.volume = 0.12;
    audio.muted = muted;
    if (muted) {
      audio.pause();
    } else {
      void audio.play().catch(() => {
        setMuted(true);
        try {
          window.localStorage.setItem("adventures-music-muted", "true");
        } catch {
          // Audio control remains usable when browser storage is unavailable.
        }
      });
    }
  }, [muted, query.data?.url]);

  function playWelcome() {
    const audio = audioRef.current;
    const musicUrl = query.data?.url;
    const welcomeUrl = welcomeQuery.data?.url;
    if (!audio || !musicUrl || !welcomeUrl) return;

    welcomeSequenceRef.current = true;
    setShowHint(false);
    setMuted(false);
    audio.pause();
    audio.loop = false;
    audio.volume = 0.12;
    audio.muted = false;
    audio.onended = () => {
      welcomeSequenceRef.current = false;
      audio.onended = null;
      audio.src = musicUrl;
      audio.loop = true;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        setMuted(true);
        audio.muted = true;
      });
    };
    audio.src = welcomeUrl;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      welcomeSequenceRef.current = false;
      audio.onended = null;
      audio.src = musicUrl;
      audio.loop = true;
      setMuted(true);
      audio.muted = true;
    });
    try {
      window.localStorage.setItem("adventures-music-muted", "false");
    } catch {
      // Playback remains available when browser storage is unavailable.
    }
  }

  function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    if (welcomeSequenceRef.current) {
      welcomeSequenceRef.current = false;
      audio.onended = null;
    }
    setShowHint(false);

    if (muted) {
      audio.volume = 0.12;
      audio.muted = false;
      // Call play synchronously in the click handler to preserve the browser's user activation.
      const playback = audio.play();
      setMuted(false);
      void playback.catch(() => {
        setMuted(true);
        audio.muted = true;
        try {
          window.localStorage.setItem("adventures-music-muted", "true");
        } catch {
          // Audio control remains usable when browser storage is unavailable.
        }
      });
      try {
        window.localStorage.setItem("adventures-music-muted", "false");
      } catch {
        // Audio control remains usable when browser storage is unavailable.
      }
      return;
    }

    audio.pause();
    audio.muted = true;
    setMuted(true);
    try {
      window.localStorage.setItem("adventures-music-muted", "true");
    } catch {
      // Audio control remains usable when browser storage is unavailable.
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {query.data?.url ? <audio ref={audioRef} src={query.data.url} loop preload="none" /> : null}
      <button
        type="button"
        onClick={playWelcome}
        disabled={!query.data?.url || !welcomeQuery.data?.url}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 text-xs font-semibold text-brand-green transition hover:bg-brand-green/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
        aria-label={t("Play EVO welcome")}
      >
        <Play className="size-3.5" aria-hidden="true" />
        {t("Meet EVO")}
      </button>
      {showHint ? (
        <span className="inline-flex max-w-40 items-center gap-1.5 text-right text-[11px] leading-tight text-cyan-300">
          <Music2 className="size-3 shrink-0" aria-hidden="true" />
          {t("There’s a soundtrack waiting for you")}
        </span>
      ) : null}
      <button
        type="button"
        onClick={toggleMusic}
        disabled={!query.data?.url}
        aria-label={muted ? "Play adventure soundtrack" : "Mute adventure soundtrack"}
        aria-pressed={!muted}
        title={muted ? "Play soundtrack" : "Mute soundtrack"}
        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
      >
        {muted ? (
          <VolumeX className="size-4" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

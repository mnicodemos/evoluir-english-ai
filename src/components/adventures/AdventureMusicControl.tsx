import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music2, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAdventureWelcomeAudio, getSharedMusicAsset } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/** Welcomes students automatically when permitted, with an accessible manual fallback. */
export function AdventureMusicControl({ welcomeVoice }: { welcomeVoice: "roberta" | "arabella" }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const getMusic = useServerFn(getSharedMusicAsset);
  const audioRef = useRef<HTMLAudioElement>(null);
  const welcomeSequenceRef = useRef(false);
  const [muted, setMuted] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const autoWelcomeAttemptedRef = useRef(false);
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
      setMuted(window.localStorage.getItem("adventures-music-muted") === "true");
    } catch {
      setMuted(false);
    }
  }, []);

  useEffect(() => {
    const welcomeUrl = welcomeQuery.data?.url;
    if (!welcomeUrl || autoWelcomeAttemptedRef.current) return;

    // Browsers often block autoplay until the learner interacts with the page.
    // Use that first interaction to play EVO's greeting, independently of music preference.
    const startWelcome = () => {
      const audio = audioRef.current;
      if (!audio || autoWelcomeAttemptedRef.current) return;
      autoWelcomeAttemptedRef.current = true;
      audio.pause();
      audio.src = welcomeUrl;
      audio.currentTime = 0;
      audio.volume = 1;
      audio.muted = false;
      audio.loop = false;
      welcomeSequenceRef.current = true;
      setShowHint(false);
      void audio.play().then(() => {
        audio.onended = () => {
          welcomeSequenceRef.current = false;
          audio.onended = null;
          if (query.data?.url) {
            audio.src = query.data.url;
            audio.loop = true;
          }
        };
      }).catch(() => {
        welcomeSequenceRef.current = false;
        handleAutoplayBlocked(audio);
      });
    };

    window.addEventListener("pointerdown", startWelcome, { once: true });
    window.addEventListener("keydown", startWelcome, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startWelcome);
      window.removeEventListener("keydown", startWelcome);
    };
  }, [welcomeQuery.data?.url, query.data?.url]);


  function handleAutoplayBlocked(audio: HTMLAudioElement) {
    audio.pause();
    audio.muted = true;
    setMuted(true);
    setShowHint(true);
    // Do not persist an autoplay restriction as a user mute preference.
  }

  function playWelcome() {
    const audio = audioRef.current;
    const welcomeUrl = welcomeQuery.data?.url;
    if (!audio || !welcomeUrl) return;

    autoWelcomeAttemptedRef.current = true;
    welcomeSequenceRef.current = true;
    setShowHint(false);
    audio.pause();
    audio.src = welcomeUrl;
    audio.currentTime = 0;
    audio.loop = false;
    audio.volume = 1;
    audio.muted = false;
    audio.onended = () => {
      welcomeSequenceRef.current = false;
      audio.onended = null;
      if (query.data?.url) {
        audio.src = query.data.url;
        audio.loop = true;
      }
    };
    void audio.play().catch(() => {
      welcomeSequenceRef.current = false;
      handleAutoplayBlocked(audio);
    });
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
      if (query.data?.url) audio.src = query.data.url;
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
    <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
      {query.data?.url || welcomeQuery.data?.url ? <audio ref={audioRef} src={query.data?.url ?? welcomeQuery.data?.url} loop preload="none" /> : null}
      <button
        type="button"
        onClick={playWelcome}
        disabled={!welcomeQuery.data?.url}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-green/40 bg-brand-green/10 px-3 text-xs font-semibold text-brand-green transition hover:bg-brand-green/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
        aria-label={t("Play EVO welcome")}
      >
        <Play className="size-3.5" aria-hidden="true" />
        {t("Meet EVO")}
      </button>
      {showHint ? (
        <span className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 text-center text-[11px] leading-tight text-cyan-300 sm:max-w-40">
          <Music2 className="size-3 shrink-0" aria-hidden="true" />
          {lang === "pt"
            ? "Se o áudio não começar, toque em Meet EVO."
            : "If audio does not start, tap Meet EVO."}
        </span>
      ) : null}
      <button
        type="button"
        onClick={toggleMusic}
        disabled={!query.data?.url}
        aria-label={muted ? "Play adventure soundtrack" : "Mute adventure soundtrack"}
        aria-pressed={!muted}
        title={muted ? "Play soundtrack" : "Mute soundtrack"}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
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

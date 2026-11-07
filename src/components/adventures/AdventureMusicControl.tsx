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
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
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
    } finally {
      setPreferenceLoaded(true);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const musicUrl = query.data?.url;
    const welcomeUrl = welcomeQuery.data?.url;
    const canAutoPlay =
      audio && musicUrl && welcomeUrl && preferenceLoaded && !autoWelcomeAttemptedRef.current;
    if (!canAutoPlay) return;

    autoWelcomeAttemptedRef.current = true;
    if (muted) return;

    welcomeSequenceRef.current = true;
    audio.pause();
    audio.volume = 0.12;
    audio.muted = false;
    audio.loop = false;
    audio.src = welcomeUrl;
    audio.onended = () => {
      welcomeSequenceRef.current = false;
      audio.onended = null;
      audio.src = musicUrl;
      audio.loop = true;
      audio.currentTime = 0;
      void audio.play().catch(() => handleAutoplayBlocked(audio));
    };
    void audio.play().catch(() => {
      welcomeSequenceRef.current = false;
      audio.onended = null;
      audio.src = musicUrl;
      audio.loop = true;
      handleAutoplayBlocked(audio);
    });
  }, [muted, preferenceLoaded, query.data?.url, welcomeQuery.data?.url]);

  function handleAutoplayBlocked(audio: HTMLAudioElement) {
    audio.pause();
    audio.muted = true;
    setMuted(true);
    // Do not persist an autoplay restriction as a user mute preference.
  }

  function playWelcome() {
    const audio = audioRef.current;
    const musicUrl = query.data?.url;
    const welcomeUrl = welcomeQuery.data?.url;
    if (!audio || !musicUrl || !welcomeUrl) return;

    welcomeSequenceRef.current = true;
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
      handleAutoplayBlocked(audio);
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
    <div className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 pr-2 shadow-sm transition-colors hover:bg-white/[0.06] sm:w-[min(24rem,100%)]">
      {query.data?.url ? <audio ref={audioRef} src={query.data.url} loop preload="none" /> : null}
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green">
        <Music2 className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
        <button
          type="button"
          onClick={playWelcome}
          disabled={!query.data?.url || !welcomeQuery.data?.url}
          className="w-fit text-left text-xs font-semibold text-foreground transition-colors hover:text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          aria-label={t("Meet EVO")}
        >
          {t("Meet EVO")}
        </button>
        <span className="truncate text-[10.5px] text-muted-foreground">
          {lang === "pt" ? "Boas-vindas da EVO · trilha sonora" : "A welcome from EVO · adventure soundtrack"}
        </span>
      </span>
      <button
        type="button"
        onClick={toggleMusic}
        disabled={!query.data?.url}
        aria-label={muted ? t("Play adventure soundtrack") : t("Mute adventure soundtrack")}
        aria-pressed={!muted}
        title={muted ? t("Play soundtrack") : t("Mute soundtrack")}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
      >
        {muted ? (
          <VolumeX className="size-4" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4 text-brand-green" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

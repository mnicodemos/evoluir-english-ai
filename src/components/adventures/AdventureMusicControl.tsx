import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAdventureWelcomeAudio, getSharedMusicAsset } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/** Plays EVO's welcome and the adventure soundtrack on independent audio channels. */
export function AdventureMusicControl({ welcomeVoice }: { welcomeVoice: "roberta" | "arabella" }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const getMusic = useServerFn(getSharedMusicAsset);
  const getWelcomeAudio = useServerFn(getAdventureWelcomeAudio);
  const evoAudioRef = useRef<HTMLAudioElement>(null);
  const musicAudioRef = useRef<HTMLAudioElement>(null);
  const welcomeStartedRef = useRef(false);
  const welcomeFinishedRef = useRef(false);
  const fadeFrameRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(() => {
    try {
      return window.localStorage.getItem("adventures-music-muted") === "true";
    } catch {
      return false;
    }
  });

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

  const welcomeUrl = welcomeQuery.data?.url;
  const musicUrl = query.data?.url;

  const fadeMusicTo = useCallback((target: number) => {
    const audio = musicAudioRef.current;
    if (!audio) return;
    if (fadeFrameRef.current !== null) {
      window.cancelAnimationFrame(fadeFrameRef.current);
    }
    const startVolume = audio.volume;
    const startTime = performance.now();
    const duration = 600;
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      audio.volume = startVolume + (target - startVolume) * progress;
      if (progress < 1) fadeFrameRef.current = window.requestAnimationFrame(step);
      else fadeFrameRef.current = null;
    };
    fadeFrameRef.current = window.requestAnimationFrame(step);
  }, []);

  const startWelcome = useCallback(() => {
    const audio = evoAudioRef.current;
    if (!audio || !welcomeUrl || welcomeStartedRef.current) return;
    audio.currentTime = 0;
    audio.volume = 1;
    audio.muted = false;
    const playback = audio.play();
    void playback.then(() => {
      welcomeStartedRef.current = true;
      welcomeFinishedRef.current = false;
      if (musicAudioRef.current && !muted) fadeMusicTo(0.03);
    }).catch(() => {
      // Keep the welcome eligible for the next genuine user interaction.
      welcomeStartedRef.current = false;
    });
  }, [fadeMusicTo, muted, welcomeUrl]);

  const startMusic = useCallback(() => {
    const audio = musicAudioRef.current;
    if (!audio || !musicUrl || muted) return;
    audio.loop = true;
    audio.volume = welcomeStartedRef.current && !welcomeFinishedRef.current ? 0.03 : 0.12;
    audio.muted = false;
    void audio.play().catch(() => {
      // A blocked autoplay can be retried from the next user interaction.
    });
  }, [musicUrl, muted]);

  const startExperienceAudio = useCallback(() => {
    startWelcome();
    startMusic();
  }, [startMusic, startWelcome]);

  useEffect(() => {
    if (welcomeUrl || musicUrl) startExperienceAudio();
  }, [musicUrl, startExperienceAudio, welcomeUrl]);

  useEffect(() => {
    const retryFromInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-adventure-audio-control]")) return;
      startExperienceAudio();
    };
    window.addEventListener("pointerdown", retryFromInteraction, true);
    window.addEventListener("keydown", retryFromInteraction, true);
    return () => {
      window.removeEventListener("pointerdown", retryFromInteraction, true);
      window.removeEventListener("keydown", retryFromInteraction, true);
    };
  }, [startExperienceAudio]);

  useEffect(() => {
    const audio = evoAudioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      welcomeFinishedRef.current = true;
      if (!muted) fadeMusicTo(0.12);
    };
    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [fadeMusicTo, muted]);

  useEffect(() => {
    return () => {
      if (fadeFrameRef.current !== null) window.cancelAnimationFrame(fadeFrameRef.current);
    };
  }, []);

  function playWelcome() {
    welcomeStartedRef.current = false;
    welcomeFinishedRef.current = false;
    startWelcome();
  }

  function toggleMusic() {
    const audio = musicAudioRef.current;
    if (!audio || !musicUrl) return;
    const nextMuted = !muted;
    setMuted(nextMuted);
    audio.muted = nextMuted;
    try {
      window.localStorage.setItem("adventures-music-muted", String(nextMuted));
    } catch {
      // Audio controls remain usable when browser storage is unavailable.
    }
    if (nextMuted) {
      audio.pause();
      if (fadeFrameRef.current !== null) {
        window.cancelAnimationFrame(fadeFrameRef.current);
        fadeFrameRef.current = null;
      }
    } else {
      startMusic();
    }
  }

  return (
    <div
      data-adventure-audio-control
      className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 pr-2 shadow-sm transition-colors hover:bg-white/[0.06] sm:w-[min(24rem,100%)]"
    >
      {welcomeUrl ? <audio ref={evoAudioRef} src={welcomeUrl} preload="auto" /> : null}
      {musicUrl ? <audio ref={musicAudioRef} src={musicUrl} loop preload="auto" /> : null}
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green">
        <Music2 className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
        <button
          type="button"
          onClick={playWelcome}
          disabled={!welcomeUrl}
          className="w-fit text-left text-xs font-semibold text-foreground transition-colors hover:text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          aria-label={t("Meet EVO")}
        >
          {t("Meet EVO")}
        </button>
        <span className="truncate text-[10.5px] text-muted-foreground">
          {lang === "pt"
            ? "Boas-vindas da EVO · trilha sonora"
            : "A welcome from EVO · adventure soundtrack"}
        </span>
      </span>
      <button
        type="button"
        onClick={toggleMusic}
        disabled={!musicUrl}
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

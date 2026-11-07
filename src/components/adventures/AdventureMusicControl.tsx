import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAdventureWelcomeAudio, getSharedMusicAsset } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { ADVENTURE_MUSIC_VOLUME, playAdventureMusic } from "@/lib/adventureAudio";
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
  const welcomeAttemptingRef = useRef(false);
  const welcomeFinishedRef = useRef(false);
  const musicStartedRef = useRef(false);
  const musicAttemptingRef = useRef(false);
  const mutedRef = useRef(false);
  const removeInteractionListenersRef = useRef<(() => void) | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [preferenceReady, setPreferenceReady] = useState(false);
  useEffect(() => {
    let savedMuted = false;
    try {
      savedMuted = window.localStorage.getItem("adventures-music-muted") === "true";
    } catch {
      // Use the default when browser storage is unavailable.
    }
    mutedRef.current = savedMuted;
    setMuted(savedMuted);
    setPreferenceReady(true);
  }, []);

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
    if (!audio || !welcomeUrl || welcomeStartedRef.current || welcomeAttemptingRef.current) return;
    audio.currentTime = 0;
    audio.volume = 1;
    audio.muted = false;
    welcomeAttemptingRef.current = true;
    const playback = audio.play();
    void playback
      .then(() => {
        welcomeStartedRef.current = true;
        welcomeAttemptingRef.current = false;
        welcomeFinishedRef.current = false;
        if (musicAudioRef.current && !mutedRef.current) fadeMusicTo(0.03);
        if (musicStartedRef.current) removeInteractionListenersRef.current?.();
      })
      .catch(() => {
        // Keep the welcome eligible for the next genuine user interaction.
        welcomeStartedRef.current = false;
        welcomeAttemptingRef.current = false;
      });
  }, [fadeMusicTo, welcomeUrl]);

  const startMusic = useCallback(() => {
    const audio = musicAudioRef.current;
    if (!audio || !musicUrl || mutedRef.current || musicAttemptingRef.current) return;
    musicAttemptingRef.current = true;
    void playAdventureMusic(audio, mutedRef.current, Boolean(welcomeUrl), welcomeFinishedRef.current)
      .then((started) => {
        musicAttemptingRef.current = false;
        musicStartedRef.current = started && !audio.paused;
        setMusicPlaying(musicStartedRef.current);
        if (musicStartedRef.current && welcomeStartedRef.current) removeInteractionListenersRef.current?.();
      });
  }, [musicUrl, welcomeUrl]);

  const startExperienceAudio = useCallback(() => {
    startWelcome();
    startMusic();
  }, [startMusic, startWelcome]);

  useEffect(() => {
    if (preferenceReady && (welcomeUrl || musicUrl)) startExperienceAudio();
  }, [musicUrl, preferenceReady, startExperienceAudio, welcomeUrl]);

  useEffect(() => {
    const retryFromInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-adventure-audio-control]")) return;
      if (!welcomeStartedRef.current) startWelcome();
      if (!mutedRef.current && !musicStartedRef.current) startMusic();
    };
    const removeListeners = () => {
      window.removeEventListener("pointerdown", retryFromInteraction, true);
      window.removeEventListener("keydown", retryFromInteraction, true);
      removeInteractionListenersRef.current = null;
    };
    removeInteractionListenersRef.current = removeListeners;
    window.addEventListener("pointerdown", retryFromInteraction, true);
    window.addEventListener("keydown", retryFromInteraction, true);
    return removeListeners;
  }, [startMusic, startWelcome]);

  useEffect(() => {
    return () => {
      if (fadeFrameRef.current !== null) window.cancelAnimationFrame(fadeFrameRef.current);
    };
  }, []);

  function playWelcome() {
    welcomeStartedRef.current = false;
    welcomeAttemptingRef.current = false;
    welcomeFinishedRef.current = false;
    startWelcome();
    if (!muted && musicAudioRef.current?.paused) startMusic();
  }

  function toggleMusic() {
    const audio = musicAudioRef.current;
    if (!audio || !musicUrl) return;
    // A rejected autoplay is stopped, not muted: this tap must play, not mute it.
    const nextMuted = musicPlaying && !muted;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    audio.muted = nextMuted;
    try {
      window.localStorage.setItem("adventures-music-muted", String(nextMuted));
    } catch {
      // Audio controls remain usable when browser storage is unavailable.
    }
    if (nextMuted) {
      audio.pause();
      musicStartedRef.current = false;
      setMusicPlaying(false);
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
      {welcomeUrl ? (
        <audio
          ref={evoAudioRef}
          src={welcomeUrl}
          preload="auto"
          onEnded={() => {
            welcomeFinishedRef.current = true;
            welcomeAttemptingRef.current = false;
            const music = musicAudioRef.current;
            if (mutedRef.current || !music || !musicUrl) return;

            // The soundtrack may have been blocked while EVO's voice was playing.
            // Retry at the voice-completion boundary before fading it up.
            if (music.paused) {
              music.loop = true;
              music.muted = false;
              music.volume = ADVENTURE_MUSIC_VOLUME;
              void music
                .play()
                .then(() => {
                  musicStartedRef.current = true;
                  setMusicPlaying(true);
                  fadeMusicTo(ADVENTURE_MUSIC_VOLUME);
                  removeInteractionListenersRef.current?.();
                })
                .catch(() => {
                  musicStartedRef.current = false;
                  setMusicPlaying(false);
                  // Keep the explicit soundtrack control available as a fallback.
                });
              return;
            }

            musicStartedRef.current = true;
            setMusicPlaying(true);
            fadeMusicTo(ADVENTURE_MUSIC_VOLUME);
            removeInteractionListenersRef.current?.();
          }}
        />
      ) : null}
      {musicUrl ? <audio ref={musicAudioRef} src={musicUrl} loop preload="auto" onPlaying={() => setMusicPlaying(true)} onPause={() => { musicStartedRef.current = false; setMusicPlaying(false); }} /> : null}
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green">
        <Music2 className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden py-0.5">
        <Button
          variant="ghost"
          type="button"
          onClick={playWelcome}
          disabled={!welcomeUrl}
          className="h-auto min-h-0 w-fit justify-start whitespace-normal p-0 text-left text-xs font-semibold leading-[14px] text-foreground transition-colors hover:bg-transparent hover:text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          aria-label={t("Meet EVO")}
        >
          {t("Meet EVO")}
        </Button>
        <span className="truncate text-[10.5px] leading-[13px] text-muted-foreground">
          {lang === "pt"
            ? "Boas-vindas da EVO · trilha sonora"
            : "A welcome from EVO · adventure soundtrack"}
        </span>
      </span>
      <Button variant="ghost"
        type="button"
        onClick={toggleMusic}
        disabled={!musicUrl}
        aria-label={!musicPlaying || muted ? t("Play adventure soundtrack") : t("Mute adventure soundtrack")}
        aria-pressed={musicPlaying && !muted}
        title={!musicPlaying || muted ? t("Play soundtrack") : t("Mute soundtrack")}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
      >
        {muted || !musicPlaying ? (
          <VolumeX className="size-4" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4 text-brand-green" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}

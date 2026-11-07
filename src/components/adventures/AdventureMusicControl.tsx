import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getAdventureWelcomeAudio, getSharedMusicAsset } from "@/lib/admin.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/** Plays EVO's welcome on the first permitted interaction, independently of soundtrack settings. */
export function AdventureMusicControl({ welcomeVoice }: { welcomeVoice: "roberta" | "arabella" }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const getMusic = useServerFn(getSharedMusicAsset);
  const audioRef = useRef<HTMLAudioElement>(null);
  const welcomeSequenceRef = useRef(false);
  const autoWelcomeAttemptedRef = useRef(false);
  const [muted, setMuted] = useState(true);
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
      setMuted(window.localStorage.getItem("adventures-music-muted") === "true");
    } catch {
      setMuted(false);
    }
  }, []);

  function startSoundtrackAfterWelcome(audio: HTMLAudioElement) {
    const musicUrl = query.data?.url;
    if (!musicUrl) return;

    try {
      if (window.localStorage.getItem("adventures-music-muted") === "true") {
        setMuted(true);
        audio.muted = true;
        return;
      }
    } catch {
      // Continue with playback when storage is unavailable.
    }

    audio.src = musicUrl;
    audio.currentTime = 0;
    audio.volume = 0.12;
    audio.muted = false;
    audio.loop = true;
    void audio
      .play()
      .then(() => {
        setMuted(false);
      })
      .catch(() => {
        audio.pause();
        audio.muted = true;
        setMuted(true);
      });
  }

  useEffect(() => {
    const welcomeUrl = welcomeQuery.data?.url;
    if (!welcomeUrl || autoWelcomeAttemptedRef.current) return;

    const startWelcome = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-adventure-audio-control]")) return;

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

      void audio
        .play()
        .then(() => {
          audio.onended = () => {
            welcomeSequenceRef.current = false;
            audio.onended = null;
            startSoundtrackAfterWelcome(audio);
          };
        })
        .catch(() => {
          welcomeSequenceRef.current = false;
          audio.pause();
          audio.muted = true;
        });
    };

    window.addEventListener("pointerdown", startWelcome);
    window.addEventListener("keydown", startWelcome);
    return () => {
      window.removeEventListener("pointerdown", startWelcome);
      window.removeEventListener("keydown", startWelcome);
    };
  }, [welcomeQuery.data?.url, query.data?.url]);

  function playWelcome() {
    const audio = audioRef.current;
    const welcomeUrl = welcomeQuery.data?.url;
    if (!audio || !welcomeUrl) return;

    autoWelcomeAttemptedRef.current = true;
    welcomeSequenceRef.current = true;
    audio.pause();
    audio.src = welcomeUrl;
    audio.currentTime = 0;
    audio.loop = false;
    audio.volume = 1;
    audio.muted = false;
    audio.onended = () => {
      welcomeSequenceRef.current = false;
      audio.onended = null;
      startSoundtrackAfterWelcome(audio);
    };

    void audio.play().catch(() => {
      welcomeSequenceRef.current = false;
      audio.pause();
      audio.muted = true;
    });
  }

  function toggleMusic() {
    const audio = audioRef.current;
    const musicUrl = query.data?.url;
    if (!audio || !musicUrl) return;

    if (welcomeSequenceRef.current) {
      welcomeSequenceRef.current = false;
      audio.onended = null;
    }

    if (muted) {
      audio.pause();
      audio.src = musicUrl;
      audio.currentTime = 0;
      audio.loop = true;
      audio.volume = 0.12;
      audio.muted = false;
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
    <div
      data-adventure-audio-control
      className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 pr-2 shadow-sm transition-colors hover:bg-white/[0.06] sm:w-[min(24rem,100%)]"
    >
      {query.data?.url || welcomeQuery.data?.url ? (
        <audio ref={audioRef} src={query.data?.url ?? welcomeQuery.data?.url} loop preload="none" />
      ) : null}
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green">
        <Music2 className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
        <button
          type="button"
          onClick={playWelcome}
          disabled={!welcomeQuery.data?.url}
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

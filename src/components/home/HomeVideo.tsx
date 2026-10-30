import { Play } from "lucide-react";
import { useState } from "react";

/**
 * The owner's 23-second brand video on the public home (owner request,
 * 2026-10-31). The poster shows until the visitor taps play, so the page loads
 * no video at all (preload none, about 2.3 MB at 720p once played); it plays
 * with sound and the player's own controls, and the captions are burned in.
 */
export function HomeVideo() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
      {playing ? (
        <video
          className="aspect-video w-full"
          src="/home/evoluir-hero.mp4"
          poster="/home/evoluir-hero-poster.webp"
          controls
          autoPlay
          playsInline
          preload="auto"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative block aspect-video w-full"
          aria-label="Assistir ao vídeo do Evoluir+ (23 segundos)"
        >
          <img
            src="/home/evoluir-hero-poster.webp"
            alt=""
            width={1280}
            height={720}
            loading="lazy"
            className="size-full object-cover"
          />
          <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/5" />
          <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-success text-primary-foreground shadow-lg ring-8 ring-success/20 transition-transform group-hover:scale-105 sm:size-20">
            <Play className="ml-1 size-7 fill-current sm:size-8" aria-hidden="true" />
          </span>
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            0:23
          </span>
        </button>
      )}
    </div>
  );
}

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
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent transition-opacity group-hover:opacity-70" />
          {/* Bottom-left glass pill (owner review, 2026-10-31): the centred
              button sat on EVO's chin; the play is the brand's CTA turquoise. */}
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 py-1 pl-1 pr-3 text-xs sm:gap-2.5 sm:py-1.5 sm:pl-1.5 sm:pr-4 sm:text-sm font-semibold text-white backdrop-blur-md transition-colors group-hover:bg-black/60 sm:bottom-5 sm:left-5">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105 sm:size-10">
              <Play className="ml-0.5 size-3.5 fill-current sm:size-5" aria-hidden="true" />
            </span>
            <span>Assistir</span>
            <span className="text-white/60">· 0:23</span>
          </span>
        </button>
      )}
    </div>
  );
}

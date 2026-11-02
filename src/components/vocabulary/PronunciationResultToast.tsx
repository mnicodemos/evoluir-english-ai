import { CheckCircle2, RefreshCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** Score bands of the pronunciation check (70 passes; under 55 counts as a miss). */
export function pronunciationBand(score: number): "pass" | "close" | "miss" {
  if (score >= 70) return "pass";
  if (score >= 55) return "close";
  return "miss";
}

const BAND_STYLE = {
  pass: {
    accent: "text-brand-green",
    badge: "bg-brand-green/15 text-brand-green ring-brand-green/35",
    line: "via-brand-green/70",
    glow: "bg-brand-green/20",
    Icon: CheckCircle2,
  },
  close: {
    accent: "text-amber-400",
    badge: "bg-amber-400/12 text-amber-300 ring-amber-400/35",
    line: "via-amber-400/70",
    glow: "bg-amber-400/15",
    Icon: RefreshCw,
  },
  miss: {
    accent: "text-amber-400",
    badge: "bg-amber-400/12 text-amber-300 ring-amber-400/35",
    line: "via-amber-400/70",
    glow: "bg-amber-400/15",
    Icon: RefreshCw,
  },
} as const;

/** Premium HUD card for a pronunciation result on the Vocabulary page. */
export function PronunciationResultToast({
  toastId,
  score,
  word,
  heard,
  pt,
  hint,
}: {
  toastId: string | number;
  score: number;
  word: string;
  heard?: string;
  pt: boolean;
  hint?: ReactNode;
}) {
  const band = pronunciationBand(score);
  const s = BAND_STYLE[band];
  const title =
    band === "pass"
      ? pt
        ? "Pronúncia aprovada"
        : "Pronunciation approved"
      : band === "close"
        ? pt
          ? "Quase no ponto"
          : "Almost there"
        : pt
          ? "Vamos calibrar o som"
          : "Let's tune the sound";
  const footer =
    band === "pass"
      ? pt
        ? "Palavra dominada · próxima palavra"
        : "Word mastered · next word"
      : band === "close"
        ? pt
          ? "Ouça o modelo e repita (mínimo 70%)"
          : "Hear the model and repeat (70% to pass)"
        : pt
          ? "Ela volta para reforço · repita a palavra"
          : "It comes back for practice · repeat the word";

  return (
    <div
      role="status"
      className="pronunciation-hud relative w-[min(34rem,calc(100vw-2rem))] max-[600px]:w-full overflow-hidden rounded-2xl p-3.5 text-slate-100"
    >
      <span
        aria-hidden
        className={cn("absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent", s.line)}
      />
      <span
        aria-hidden
        className={cn("pointer-events-none absolute -left-8 -top-8 size-24 rounded-full blur-2xl", s.glow)}
      />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10",
            s.accent,
          )}
        >
          <s.Icon className="size-[18px]" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold leading-tight">
              {title}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ring-1 ring-inset",
                s.badge,
              )}
            >
              {score}%
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-400" translate="no">
            {word}
          </p>
          {band !== "pass" && heard ? (
            <div className="mt-2.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 ring-1 ring-inset ring-white/[0.06]">
              <span className="text-[11px] uppercase tracking-[0.08em] text-slate-400">
                {pt ? "A EVO ouviu" : "EVO heard"}
              </span>
              <p className="truncate text-sm font-medium italic text-slate-100" translate="no">
                “{heard}”
              </p>
            </div>
          ) : null}
          {band !== "pass" && hint ? <div className="mt-2 text-xs text-slate-300">{hint}</div> : null}
          <p className={cn("mt-2 text-xs font-medium", band === "pass" ? s.accent : "text-slate-300")}>
            {footer}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          aria-label={pt ? "Fechar" : "Close"}
          className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

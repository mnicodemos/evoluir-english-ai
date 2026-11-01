import { Link } from "@tanstack/react-router";
import {
  BookMarked,
  Check,
  ChevronDown,
  ChevronRight,
  Flower2,
  Crown,
  Plus,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { EvoAvatar } from "@/components/EvoAvatar";
import { MeditationSection } from "@/components/life/MeditationSection";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { ACCENTS } from "@/lib/accents";
import { graphitePanelClass } from "@/lib/surfaces";
import { cn } from "@/lib/utils";

export function useLifeT() {
  const { lang } = useUiLang();
  return {
    lang,
    t: (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label),
  };
}

/**
 * Header of the one-page Life+ AI: name, slogan and the visual guide (user
 * request). No Premium badge: Life+ AI mixes free and Premium parts.
 */
export function LifeHeader() {
  const { t } = useLifeT();
  return (
    <PageHeader
      icon={Sprout}
      accent="diamond"
      className="mb-4"
      title={
        // The name with its plus in the brand colour, like Evoluir+.
        <span translate="no">
          {"Life"}
          <span className="text-brand-green">+</span>
          {" AI"}
        </span>
      }
      description={t("Evolve one day at a time.")}
      actions={
        // Meditations in a glass capsule like the Dashboard's Weather talk
        // (owner request, 2026-11-01: it replaced Decisions, which moved to
        // its own tab, and opens a dropdown to pick and hear a session right
        // there), with the guide in its own grey circle at the end like the
        // bell. Phones keep the icons only, so the title keeps its room.
        <div className="flex h-11 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <MeditationsMenu />
          {/* A label on hover names the guide (user request, 2026-10-23). */}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/life/guide"
                  aria-label={t("How Life+ AI works")}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
                >
                  <BookMarked className="size-4" aria-hidden="true" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={8}>
                {t("How Life+ AI works")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    />
  );
}

/**
 * The header's Meditations dropdown (owner request, 2026-11-01: the
 * meditations left the page body; the student picks and hears a session right
 * here), in the notifications popover's frosted graphite. While a session
 * plays, a click outside does not close it (closing stops the voice); Stop,
 * Escape or the capsule do.
 */
function MeditationsMenu() {
  const { t } = useLifeT();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  // #meditation (the Focus break's "Two-minute break" link) opens the menu.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === "#meditation") setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t("Meditations")} · ${t("Listen and relax")}`}
          className="group flex h-9 shrink-0 items-center gap-2.5 rounded-full text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 sm:pr-3"
        >
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-rose-400/15 text-rose-300">
            <Flower2 className="size-[1.15rem]" aria-hidden="true" />
            {playing ? (
              <span
                className="absolute right-0.5 top-0.5 size-2 rounded-full bg-brand-green ring-2 ring-background"
                aria-hidden="true"
              />
            ) : null}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-xs font-semibold text-foreground">{t("Meditations")}</span>
            <span className="block text-[10.5px] text-muted-foreground">
              {t("Listen and relax")}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "hidden size-3.5 shrink-0 text-muted-foreground transition-transform sm:block",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        onInteractOutside={(event) => {
          if (playing) event.preventDefault();
        }}
        className={`dashboard-shell dark w-[min(24rem,calc(100vw-1.5rem))] p-1 ${graphitePanelClass}`}
      >
        <MeditationSection variant="menu" onPlayingChange={setPlaying} />
      </PopoverContent>
    </Popover>
  );
}

/** What Premium adds to Life+ AI, each marked with a gold crown for free students. */
const PREMIUM_ITEMS = ["Routine", "Habits", "Life Coach", "Decisions", "All meditations"] as const;

/** Shown to free students in place of the Premium parts of Life+ AI (Goals stay free). */
export function LifePremiumGate({ feature }: { feature: string }) {
  const { t } = useLifeT();
  return (
    <section className="card-soft flex flex-col items-center gap-3 p-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-amber-400/12 text-amber-400">
        <Crown className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold">{t(feature)}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t(
          "Routine, habits, decisions and the Life Coach are part of Premium. Your goals stay free.",
        )}
      </p>
      <ul className="grid w-full max-w-sm gap-1.5 text-left text-sm">
        {PREMIUM_ITEMS.map((item) => (
          <li key={item} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
            <Crown className="size-4 shrink-0 text-amber-400" aria-label="Premium" />
            {t(item)}
          </li>
        ))}
      </ul>
      <Button asChild className="bg-brand-green text-sidebar hover:bg-brand-green/90">
        <Link to="/premium">{t("See plans")}</Link>
      </Button>
    </section>
  );
}

/** Life+ AI blocks use the app-wide accents (src/lib/accents.ts). */
export const LIFE_ACCENTS = ACCENTS;

/**
 * The same header on every Life+ AI block: the icon in a tinted tile, the
 * title with an optional line under it, a count pill and the block's actions.
 */
export function LifeSectionTitle({
  id,
  icon: Icon,
  accent,
  title,
  subtitle,
  meta,
  titleClassName,
  children,
}: {
  id: string;
  icon: LucideIcon;
  accent: keyof typeof LIFE_ACCENTS;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  titleClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
          LIFE_ACCENTS[accent],
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      {/* min-w keeps the title readable on phones: the count pill and buttons
          wrap below instead of squeezing the text to one word per line
          (user report, 2026-10-17: Focus on a phone). */}
      <div className="min-w-[11rem] flex-1">
        <h2
          id={id}
          className={cn("font-display text-base font-semibold leading-tight", titleClassName)}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {meta !== undefined && meta !== null ? (
        <span className="shrink-0 rounded-full border border-border bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {meta}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** An empty list with EVO and a nudge, instead of a grey line (user request). */
export function LifeEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-white/[0.02] p-3">
      <EvoAvatar decorative className="size-9 shrink-0" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * The one check mark of Life+ AI (goal steps, tasks and habits alike; user
 * request, 2026-10-24: one system), an empty grey circle or a green one with
 * its check.
 */
export function LifeCheckMark({ done, className }: { done: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
        done
          ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
          : "border-muted-foreground/60",
        className,
      )}
      aria-hidden="true"
    >
      {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

/**
 * Creation behind a "+ Add" button under the list (user request, 2026-10-24:
 * the day's lists are for doing; adding is one tap away instead of a form
 * always open on top). The form gets close() for its save and cancel.
 */
export function LifeAddPanel({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (open)
    return (
      <div className="rounded-xl border border-border p-3">{children(() => setOpen(false))}</div>
    );
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-brand-green/50 hover:text-foreground"
    >
      <Plus className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

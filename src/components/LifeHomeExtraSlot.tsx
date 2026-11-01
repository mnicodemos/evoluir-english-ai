import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Play, Scale } from "lucide-react";

import { TomatoIcon } from "@/components/focus/TomatoIcon";
import { useFocusLog } from "@/hooks/useFocusLog";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { useProfile } from "@/hooks/useProfile";
import { focusStart, openFocusWidget } from "@/lib/focusTimer";
import { FOCUS_DAILY_TARGET, FOCUS_PRESETS, focusClock, focusSummary } from "@/lib/life";
import { openDecisionForHome } from "@/lib/lifeDecisions";
import { loadLifeDecisions } from "@/lib/lifeDecisions.functions";
import { studyToday } from "@/lib/today";
import { cn } from "@/lib/utils";

/**
 * The fourth slot of the Life+ AI card, from 2xl only, where the card spans 9
 * of 12 columns (owner decision, 2026-11-01, a product review: a fixed
 * Decisions slot would sit empty for most students, since a decision is made
 * now and then). It shows one thing: a decision still open (no option chosen)
 * with its filled scores, or else today's Focus blocks with a one-tap start.
 * Focus is free, so free students get it too.
 */
export function LifeHomeExtraSlot({ translate: t }: { translate: (label: string) => string }) {
  const { data: profile } = useProfile();
  const load = useServerFn(loadLifeDecisions);
  // The same query as /life/decisions, so a decision made there leaves here.
  const { data } = useQuery({
    queryKey: ["life-decisions", profile?.id ?? null],
    enabled: !!profile,
    queryFn: () => load(),
    staleTime: 30 * 1000,
  });
  const decision = data?.premium && data.available ? openDecisionForHome(data.decisions) : null;

  if (decision) {
    return (
      <li className="hidden min-w-0 2xl:block">
        <Link
          to="/life/decisions"
          className="flex h-full min-w-0 flex-col justify-between gap-0.5 rounded-lg bg-secondary/60 px-2.5 py-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex min-w-0 flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Scale className="size-3" aria-hidden="true" />
              {t("Open decision")}
            </span>
            <span
              className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground"
              title={t("Scores filled")}
            >
              {decision.rated}/{decision.total}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="min-w-0 flex-1 line-clamp-2 text-xs font-semibold leading-snug"
              translate="no"
            >
              {decision.title}
            </span>
            <span className="inline-flex shrink-0 items-center text-[11px] font-semibold text-brand-green">
              {t("Decide")}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </span>
          </span>
        </Link>
      </li>
    );
  }

  return <FocusSlot translate={t} />;
}

function FocusSlot({ translate: t }: { translate: (label: string) => string }) {
  const { state, view } = useFocusTimer();
  const log = useFocusLog();
  const today = focusSummary(log, studyToday());
  const active = state.phase !== "idle";
  const minutes = FOCUS_PRESETS[state.preset].focus;
  const start = () => {
    if (!active) focusStart();
    openFocusWidget();
  };

  return (
    <li className="hidden min-w-0 flex-col justify-between gap-0.5 rounded-lg bg-secondary/60 px-2.5 py-1.5 2xl:flex">
      <div className="flex min-w-0 items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <TomatoIcon className="size-3 text-red-400" />
          {t("Focus")}
        </p>
        <span
          className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground"
          title={t("Focus blocks today")}
        >
          🍅 {today.todayCount}/{FOCUS_DAILY_TARGET}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold leading-snug">
          {active ? (
            <span className={state.phase === "break" ? "text-brand-green" : "text-pink-400"}>
              {state.phase === "break" ? t("Break") : t("Focusing")} · {focusClock(view.leftMs)}
            </span>
          ) : (
            <>
              {t("Focus block")} · {minutes} min
            </>
          )}
        </p>
        <button
          type="button"
          onClick={start}
          aria-label={active ? t("Floating timer") : t("Start focus")}
          title={active ? t("Floating timer") : t("Start focus")}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60",
            active
              ? "bg-white/10 text-foreground hover:bg-white/15"
              : // Not a solid brand button: Practice now stays the Dashboard's only one.
                "bg-brand-green/15 text-brand-green ring-1 ring-brand-green/30 hover:bg-brand-green/25",
          )}
        >
          {active ? (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          ) : (
            <Play className="size-3 fill-current" aria-hidden="true" />
          )}
        </button>
      </div>
    </li>
  );
}

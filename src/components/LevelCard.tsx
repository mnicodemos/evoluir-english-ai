import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChartNoAxesColumnIncreasing, GraduationCap, Lock, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { LEVELS, findLevel } from "@/lib/level";
import { cn } from "@/lib/utils";
import { refreshAfterLevelChange } from "@/lib/refreshKeys";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * Shows the student's CEFR level as a read-only indicator: the current level,
 * the levels already conquered (max_level) and the locked ones above. Tapping
 * a conquered level opens it for review in the Learning Center without
 * changing the student's level, so practice, AI and the weekly league stay on
 * the level reached. The level itself only changes through the Final Test.
 */
export function LevelCard({
  level,
  maxLevel,
  compact = false,
}: {
  level: string;
  maxLevel?: string | null;
  compact?: boolean;
}) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const queryClient = useQueryClient();
  const [returning, setReturning] = useState(false);
  const current = findLevel(level);
  const currentIndex = LEVELS.indexOf(current);
  const highest = findLevel(maxLevel || level);
  const highestIndex = LEVELS.indexOf(highest);
  // Left over from the old level switch: studying below the level reached.
  const belowHighest = currentIndex < highestIndex;

  const returnToHighest = async () => {
    if (returning) return;
    setReturning(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ level: highest.value })
        .eq("id", user.id);
      if (error) throw error;
      await refreshAfterLevelChange(queryClient);
    } catch {
      toast.error(t("Could not change your level. Please try again."));
    } finally {
      setReturning(false);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col justify-center",
        compact ? "px-3 py-2" : "card-soft p-4",
      )}
    >
      <div className="flex items-center gap-3">
        {compact ? (
          <ChartNoAxesColumnIncreasing
            className="size-[1.925rem] shrink-0 text-dashboard-cyan"
            strokeWidth={2.8}
          />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-dashboard-cyan/10">
            <GraduationCap className="size-6 text-accent-foreground" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-bold",
              compact ? "font-display text-sm" : "text-lg sm:text-base md:text-lg",
            )}
          >
            {current.label}
          </p>
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-base sm:text-xs")}>
            {compact ? (
              <span>{current.cefr}</span>
            ) : (
              <>
                <span>Your English level</span>
                <span> · </span>
                <span>{current.cefr}</span>
              </>
            )}
          </p>
        </div>
        {belowHighest && (
          <button
            type="button"
            onClick={() => void returnToHighest()}
            disabled={returning}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-green/40 px-2.5 py-1 text-xs font-semibold text-brand-green transition hover:bg-brand-green/10 disabled:opacity-60"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            {t("Back to")} {highest.value.toUpperCase()}
          </button>
        )}
      </div>

      <ol
        className={cn("grid grid-cols-6", compact ? "mt-2 gap-1" : "mt-3 gap-2")}
        aria-label={t("CEFR levels")}
      >
        {LEVELS.map((l, i) => {
          const locked = i > highestIndex;
          const active = i === currentIndex;
          const conquered = !locked && !active;
          const code = l.value.toUpperCase();
          const chip = cn(
            "flex w-full min-w-0 items-center justify-center gap-0.5 rounded-full border text-xs font-semibold tabular-nums transition",
            compact ? "h-7" : "h-10 sm:text-sm",
          );

          if (conquered) {
            return (
              <li key={l.value}>
                <Link
                  to="/learning"
                  search={{ review: l.value }}
                  title={`${t("Review")} ${l.label}`}
                  aria-label={`${t("Review")} ${l.label}`}
                  className={cn(
                    chip,
                    "border-brand-green/25 bg-brand-green/[0.07] text-brand-green/90 hover:border-brand-green/60 hover:bg-brand-green/15 hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60",
                  )}
                >
                  <Check className="size-3 shrink-0" strokeWidth={3} aria-hidden="true" />
                  {code}
                </Link>
              </li>
            );
          }

          return (
            <li key={l.value}>
              <span
                aria-current={active ? "step" : undefined}
                title={
                  active ? `${l.label} · ${t("current level")}` : `${l.label} · ${t("locked")}`
                }
                className={cn(
                  chip,
                  active &&
                    "border-transparent bg-brand-green text-primary-foreground shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand-green)_22%,transparent)]",
                  locked && "border-border/50 text-muted-foreground/45",
                )}
              >
                {locked && <Lock className="size-3 shrink-0" aria-hidden="true" />}
                {code}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

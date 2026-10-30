import { useQuery } from "@tanstack/react-query";
import { Check, Gem, Lock } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { JEWELS } from "@/components/LeagueBadge";
import { useDiamondLevel } from "@/hooks/useDiamondCycles";
import { daysToNextDiamond, diamondName } from "@/lib/diamondCycles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { effectiveStreak, useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/uiLang";
import { graphitePanelClass } from "@/lib/surfaces";
import { cn } from "@/lib/utils";

/**
 * The ten jewels in one card (owner request, 2026-10-31: the guide sent the
 * student to the Dashboard and nobody knew which jewels exist): each jewel in
 * its colour with the days in a row it needs, the ones the student earned
 * (permanent_jewel_awards, kept even when the run of days breaks) ticked, and
 * the next one marked with the days still missing.
 */
export function JewelsCard({ translate }: { translate: (label: string) => string }) {
  const { data: profile } = useProfile();
  const { data: earnedData } = useQuery({
    // Its own key: the Dashboard keeps the highest jewel (a number) under
    // ["permanent-jewels", id], and sharing it crashed the popover.
    queryKey: ["permanent-jewels-list", profile?.id],
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // Not in the generated Supabase types until Lovable regenerates them.
      const from = supabase.from.bind(supabase) as unknown as (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{ data: { jewel_index: number }[] | null; error: Error | null }>;
        };
      };
      const { data, error } = await from("permanent_jewel_awards")
        .select("jewel_index")
        .eq("user_id", profile!.id);
      if (error) throw error;
      return (data ?? []).map((row) => row.jewel_index);
    },
  });
  const earned = Array.isArray(earnedData) ? earnedData : [];
  const streak = profile ? effectiveStreak(profile) : 0;
  // Reaching a jewel means passing every one before it, and older accounts
  // only have their highest jewel stored (backfill), so the highest award
  // marks all jewels up to it as earned and the next one is the one after it
  // (owner report, 2026-10-31: Amethyst earned, Bronze shown as next).
  const highest = earned.length ? Math.max(...earned) : -1;
  const nextIndex = highest + 1 < JEWELS.length ? highest + 1 : null;
  const pt = useUiLang().lang === "pt";
  // After the Diamond: Diamond cycles (×2, ×3, ...; migration 0099).
  const diamondLvl = useDiamondLevel(profile?.id, highest === JEWELS.length - 1);

  return (
    <>
      <ol
        className="grid grid-cols-5 gap-1.5 min-[480px]:gap-2"
        aria-label={translate("Your jewels")}
      >
        {JEWELS.map((jewel) => {
          const isEarned = jewel.index <= highest;
          const isNext = jewel.index === nextIndex;
          const left = Math.max(0, jewel.days - streak);
          return (
            <li
              key={jewel.index}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-0 py-2 text-center min-[480px]:gap-1 min-[480px]:px-2 min-[480px]:py-3",
                isEarned
                  ? "border-white/15 bg-white/[0.05]"
                  : isNext
                    ? "border-brand-green/50 bg-brand-green/[0.06]"
                    : "border-white/10 bg-transparent",
              )}
            >
              <span className="relative grid size-7 place-items-center min-[480px]:size-10">
                <Gem
                  className={cn("size-6 min-[480px]:size-8", !isEarned && !isNext && "opacity-35")}
                  style={{ color: jewel.color }}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                {isEarned ? (
                  <Check
                    className="absolute -bottom-0.5 -right-1 size-3.5 rounded-full bg-brand-green p-0.5 text-sidebar min-[480px]:-right-0.5 min-[480px]:size-4"
                    strokeWidth={3.5}
                    aria-hidden="true"
                  />
                ) : !isNext ? (
                  <Lock
                    className="absolute -bottom-0.5 -right-0.5 size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <span className="max-w-full truncate text-[9.5px] font-semibold tracking-tight min-[480px]:text-sm min-[480px]:tracking-normal">
                {pt ? jewel.namePt : jewel.name}
              </span>
              {jewel.index === JEWELS.length - 1 && diamondLvl >= 2 ? (
                <span className="rounded-full bg-brand-green/15 px-1.5 text-[10px] font-bold leading-4 text-brand-green">
                  ×{diamondLvl}
                </span>
              ) : null}
              {/* Phones: the days only, the full rule from 480 px. */}
              <span className="text-[10px] leading-tight text-muted-foreground min-[480px]:hidden">
                <span>{jewel.days}</span>{" "}
                <span>{translate(jewel.days === 1 ? "day" : "days")}</span>
              </span>
              <span className="hidden text-[11px] leading-tight text-muted-foreground min-[480px]:inline">
                {jewel.days === 1 ? (
                  translate("First study day")
                ) : (
                  <>
                    <span>{jewel.days}</span> <span>{translate("days in a row")}</span>
                  </>
                )}
              </span>
              {isEarned ? (
                <span className="hidden text-[11px] font-semibold text-brand-green min-[480px]:inline">
                  {translate("Earned")}
                </span>
              ) : isNext && profile ? (
                <span className="text-[10px] font-semibold leading-tight text-brand-green min-[480px]:text-[11px]">
                  {left === 0 ? (
                    translate("Next jewel")
                  ) : (
                    <>
                      <span className="hidden min-[480px]:inline">{translate("Next:")} </span>
                      <span>{left}</span>{" "}
                      <span>{translate(left === 1 ? "day left" : "days left")}</span>
                    </>
                  )}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {diamondLvl >= 1 ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <span>{translate("Every 63 more days in a row adds another Diamond cycle.")}</span>{" "}
          <span className="font-semibold text-brand-green">
            <span>{translate("Next:")}</span>{" "}
            <span>{diamondName(diamondLvl + 1, pt ? "pt" : "en")}</span> ·{" "}
            <span>{daysToNextDiamond(diamondLvl, streak)}</span>{" "}
            <span>{translate("days in a row")}</span>
          </span>
        </p>
      ) : null}
    </>
  );
}

/**
 * The jewels card in a popover, opened from the Dashboard's jewels cell and the
 * phone header's gem (owner request, 2026-10-31: the same frosted graphite as
 * Weather talk and the bell). It closes by itself 10 s after opening
 * (JEWELS_POPOVER_AUTO_CLOSE_MS; owner request); touching or scrolling it
 * restarts the count, so it never closes while the student reads it.
 */
export const JEWELS_POPOVER_AUTO_CLOSE_MS = 10_000;

export function JewelsPopover({
  children,
  translate,
  label,
}: {
  children: ReactNode;
  translate: (label: string) => string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [touchedAt, setTouchedAt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), JEWELS_POPOVER_AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, touchedAt]);
  const touch = () => setTouchedAt(Date.now());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="block h-full w-full rounded-2xl text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green/60"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        onPointerDown={touch}
        onScroll={touch}
        className={cn(
          "dashboard-shell dark max-h-[80dvh] w-[min(36rem,calc(100vw-1.5rem))] overflow-y-auto p-4 sm:p-5",
          graphitePanelClass,
        )}
      >
        <p className="font-display text-base font-semibold">{translate("Your jewels")}</p>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">
          {translate(
            "Jewels reward studying on days in a row, and once earned they are yours for good.",
          )}
        </p>
        <JewelsCard translate={translate} />
      </PopoverContent>
    </Popover>
  );
}

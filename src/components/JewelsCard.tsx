import { useQuery } from "@tanstack/react-query";
import { Check, Gem, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { JEWELS } from "@/components/LeagueBadge";
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
  const { data: earned = [] } = useQuery({
    queryKey: ["permanent-jewels", profile?.id],
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // Not in the generated Supabase types until Lovable regenerates them.
      const from = supabase.from as unknown as (table: string) => {
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
  const streak = profile ? effectiveStreak(profile) : 0;
  const nextIndex = JEWELS.find((jewel) => !earned.includes(jewel.index))?.index ?? null;
  const pt = useUiLang().lang === "pt";

  return (
    <ol
      className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-5"
      aria-label={translate("Your jewels")}
    >
      {JEWELS.map((jewel) => {
        const isEarned = earned.includes(jewel.index);
        const isNext = jewel.index === nextIndex;
        const left = Math.max(0, jewel.days - streak);
        return (
          <li
            key={jewel.index}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center",
              isEarned
                ? "border-white/15 bg-white/[0.05]"
                : isNext
                  ? "border-brand-green/50 bg-brand-green/[0.06]"
                  : "border-white/10 bg-transparent",
            )}
          >
            <span className="relative grid size-10 place-items-center">
              <Gem
                className={cn("size-8", !isEarned && !isNext && "opacity-35")}
                style={{ color: jewel.color }}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              {isEarned ? (
                <Check
                  className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-brand-green p-0.5 text-sidebar"
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
            <span className="text-sm font-semibold">{pt ? jewel.namePt : jewel.name}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {jewel.days === 1 ? (
                translate("First study day")
              ) : (
                <>
                  <span>{jewel.days}</span> <span>{translate("days in a row")}</span>
                </>
              )}
            </span>
            {isEarned ? (
              <span className="text-[11px] font-semibold text-brand-green">
                {translate("Earned")}
              </span>
            ) : isNext && profile ? (
              <span className="text-[11px] font-semibold text-brand-green">
                {left === 0 ? (
                  translate("Next jewel")
                ) : (
                  <>
                    <span>{translate("Next:")}</span> <span>{left}</span>{" "}
                    <span>{translate(left === 1 ? "day left" : "days left")}</span>
                  </>
                )}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The jewels card in a popover, opened from the Dashboard's jewels cell and the
 * phone header's gem (owner request, 2026-10-31: the same frosted graphite as
 * Weather talk and the bell).
 */
export function JewelsPopover({
  children,
  translate,
  label,
}: {
  children: ReactNode;
  translate: (label: string) => string;
  label: string;
}) {
  return (
    <Popover>
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

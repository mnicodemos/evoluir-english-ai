import { Link } from "@tanstack/react-router";
import { Check, ChevronRight } from "lucide-react";

import evoProfile from "@/assets/evo-profile.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFirstWeek } from "@/hooks/useFirstWeek";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

/**
 * "First week" guide for new students: a compact pill in the Dashboard
 * header (no layout change) that opens the seven steps with EVO.
 */
export function FirstWeekGuide({
  profile,
  placement,
}: {
  profile: { id: string; created_at?: string | null; league_opt_in?: boolean };
  placement: "desktop" | "mobile";
}) {
  const progress = useFirstWeek(profile);
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  if (!progress) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {placement === "mobile" ? (
          <button
            type="button"
            aria-label={`${t("First week")}: ${progress.doneCount}/${progress.total}`}
            className="relative size-8 shrink-0 rounded-full ring-2 ring-brand-green/60"
          >
            <img
              src={evoProfile.url}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full object-cover"
            />
            <span className="absolute -right-1.5 -bottom-1 rounded-full bg-brand-green px-1 text-[9px] font-bold leading-4 text-primary-foreground">
              {progress.doneCount}/{progress.total}
            </span>
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${t("First week")}: ${progress.doneCount}/${progress.total}`}
            className="h-7 shrink-0 gap-1.5 rounded-full border border-brand-green/50 bg-brand-green/10 px-2 text-xs font-semibold text-brand-green hover:bg-brand-green/20"
          >
            <img
              src={evoProfile.url}
              alt=""
              width={20}
              height={20}
              className="size-5 rounded-full object-cover"
            />
            <span>First week</span>
            <span>
              {progress.doneCount}/{progress.total}
            </span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={placement === "mobile" ? "end" : "start"}
        className="dashboard-shell dark w-[min(21rem,calc(100vw-1.5rem))] border-notification-border bg-popover/80 p-3 backdrop-blur-md backdrop-saturate-150"
      >
        <div className="flex items-center gap-3">
          <img
            src={evoProfile.url}
            alt="EVO"
            width={44}
            height={44}
            className="size-11 rounded-full object-cover ring-2 ring-brand-green/60"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Your first week with EVO</p>
            <p className="text-xs text-muted-foreground">
              <span>One step a day to get to know everything.</span>{" "}
              <span>
                {progress.doneCount}/{progress.total}
              </span>{" "}
              <span>done</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-brand-green transition-[width]"
            style={{ width: `${(progress.doneCount / progress.total) * 100}%` }}
          />
        </div>
        <ol className="mt-3 space-y-1">
          {progress.steps.map((step) => {
            const isNext = progress.next?.day === step.day;
            return (
              <li key={step.day}>
                <Link
                  to={step.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent/50",
                    isNext && "bg-brand-green/10",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                      step.isDone ? "bg-brand-green text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {step.isDone ? <Check className="size-3.5" strokeWidth={3} /> : step.day}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-medium",
                        step.isDone && "text-muted-foreground line-through",
                      )}
                    >
                      {step.title}
                    </span>
                    {isNext && (
                      <span className="block text-xs text-muted-foreground">{step.hint}</span>
                    )}
                  </span>
                  {!step.isDone && (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </PopoverContent>
    </Popover>
  );
}

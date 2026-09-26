import { useNavigate } from "@tanstack/react-router";
import { Hand, MoreVertical, Share2, Sun, Target, TreePine } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDailyReflection, getGreeting, getGreetingTone } from "@/lib/dailyReflection";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type EvoDailyReflectionProps = {
  userId: string;
  name: string;
  placement?: "desktop" | "mobile-card" | "dashboard-header";
};

export function EvoDailyReflection({
  userId,
  name,
  placement = "desktop",
}: EvoDailyReflectionProps) {
  const { lang, setLang } = useUiLang();
  const navigate = useNavigate();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const reflection = getDailyReflection(userId, now ?? new Date(0));
  const greeting = now ? t(getGreeting(now.getHours())) : t("Hello");
  const greetingTone = now ? getGreetingTone(now.getHours()) : "afternoon";
  const treeToneClass = {
    morning: "text-greeting-morning",
    afternoon: "text-greeting-afternoon",
    evening: "text-greeting-evening",
  }[greetingTone];
  const displayName = name.trim().split(/\s+/)[0];
  const copy = lang === "pt" ? "pt" : "en";

  async function shareReflection() {
    const text = `“${reflection.thought[copy]}” — ${reflection.reflection[copy]}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("EVO Daily Reflection"), text });
      } catch {
        // user dismissed the native share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("Reflection copied to clipboard"));
    } catch {
      // clipboard unavailable
    }
  }


  if (placement === "dashboard-header") {
    return (
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.68fr)] lg:items-center">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold text-foreground 2xl:text-3xl">
            <span className="truncate">
              {greeting}, {displayName}!
            </span>
             <Hand className="size-6 shrink-0 fill-warning/25 text-warning" strokeWidth={2.2} aria-hidden="true" />
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {t("Great to have you back. Let's keep building your fluency.")}
          </p>
        </div>
        <aside className="dashboard-panel flex min-w-0 items-center gap-3 rounded-lg px-3 py-2">
           <span className="grid size-11 shrink-0 place-items-center rounded-full bg-warning/10">
             <Sun className="size-6 text-warning" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-xs text-muted-foreground">
              “{reflection.thought[copy]}”
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
              {reflection.reflection[copy]}
            </p>
          </div>
          <TooltipProvider delayDuration={200}>
          <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={shareReflection}
                  aria-label={t("Share reflection")}
                  className="-m-1 rounded-md p-1 transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                >
                  <Share2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="border border-border bg-secondary text-secondary-foreground">
                {t("Share reflection")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/study-plan" })}
                  aria-label={t("Go to study plan")}
                  className="-m-1 rounded-md p-1 transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                >
                  <Target className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="border border-border bg-secondary text-secondary-foreground">
                {t("Go to study plan")}
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("More options")}
                  className="-m-1 rounded-md p-1 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent active:scale-95"
                >
                  <MoreVertical className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setLang(lang === "en" ? "pt" : "en")}>
                  {t("Change language")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </TooltipProvider>
        </aside>
      </div>
    );
  }

  return (
    <aside
      className={
        placement === "mobile-card"
          ? "card-soft flex min-w-0 items-start gap-4 p-4 lg:hidden"
          : "hidden min-w-0 items-start gap-4 border-l border-border pl-6 lg:flex"
      }
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
        <TreePine className={`size-5 ${treeToneClass}`} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-card-foreground">
          {`${greeting}${displayName ? `, ${displayName}` : ""}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">“{reflection.thought[copy]}”</p>
        <p className={"mt-3 text-xs font-semibold uppercase text-muted-foreground"}>
          {t("Daily reflection")}
        </p>
        <p className={"mt-1 text-sm text-card-foreground"}>{reflection.reflection[copy]}</p>
      </div>
    </aside>
  );
}

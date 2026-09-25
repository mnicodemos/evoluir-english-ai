import { useEffect, useState } from "react";
import { MoreVertical, Share2, Sun, Target, TreePine } from "lucide-react";

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
  const { lang } = useUiLang();
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

  if (placement === "dashboard-header") {
    return (
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.68fr)] lg:items-center">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground 2xl:text-3xl">
            {greeting}, {displayName}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {t("Great to have you back. Let's keep building your fluency.")}
          </p>
        </div>
        <aside className="dashboard-panel flex min-w-0 items-center gap-3 rounded-lg px-3 py-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning/10">
            <Sun className="size-5 text-warning" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-xs text-muted-foreground">
              “{reflection.thought[copy]}”
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
              {reflection.reflection[copy]}
            </p>
          </div>
          <div
            className="flex shrink-0 items-center gap-2 text-muted-foreground"
            aria-hidden="true"
          >
            <Share2 className="size-3.5" />
            <Target className="size-3.5" />
            <MoreVertical className="size-3.5" />
          </div>
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

import { Hand, TreePine } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import reflectionBg from "@/assets/reflection-bg.jpg.asset.json";
import { getDailyReflection, getGreeting, getGreetingTone } from "@/lib/dailyReflection";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

const reflectionBgStyle = {
  backgroundImage: `url(${reflectionBg.url})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
} as const;

type EvoDailyReflectionProps = {
  userId: string;
  name: string;
  placement?: "desktop" | "mobile-card" | "dashboard-header";
  mobileLeading?: ReactNode;
  mobileTrailing?: ReactNode;
};

export function EvoDailyReflection({
  userId,
  name,
  placement = "desktop",
  mobileLeading,
  mobileTrailing,
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
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 lg:block">
        <div className="lg:hidden">{mobileLeading}</div>
        <div className="min-w-0 text-left">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-foreground sm:text-2xl 2xl:text-3xl">
            <span className="truncate">
              {greeting}, {displayName}!
            </span>
            <Hand
              className="size-4 shrink-0 fill-warning/25 text-warning sm:size-6"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </h1>
          <p className="mt-0.5 hidden text-[11px] leading-tight text-muted-foreground sm:mt-1 sm:block sm:truncate sm:text-sm">
            {t("Great to have you back. Let's keep building your fluency.")}
          </p>
        </div>
        <div className="lg:hidden">{mobileTrailing}</div>
      </div>
    );
  }

  return (
    <aside
      style={reflectionBgStyle}
      className={
        placement === "mobile-card"
          ? "card-soft flex min-w-0 items-start gap-4 overflow-hidden p-4 lg:hidden"
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

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { getDailyReflection, getGreeting } from "@/lib/dailyReflection";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type EvoDailyReflectionProps = {
  userId: string;
  name: string;
};

export function EvoDailyReflection({ userId, name }: EvoDailyReflectionProps) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const reflection = getDailyReflection(userId, now ?? new Date(0));
  const greeting = now ? t(getGreeting(now.getHours())) : t("Hello");
  const displayName = name.trim().split(/\s+/)[0];
  const copy = lang === "pt" ? "pt" : "en";

  return (
    <aside className="hidden min-w-0 items-start gap-4 border-l border-border pl-6 lg:flex">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
        <Sparkles className="size-5 text-primary" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-card-foreground">
          {`${greeting}${displayName ? `, ${displayName}` : ""}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">“{reflection.thought[copy]}”</p>
        <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">
          {t("Daily reflection")}
        </p>
        <p className="mt-1 text-sm text-card-foreground">{reflection.reflection[copy]}</p>
      </div>
    </aside>
  );
}

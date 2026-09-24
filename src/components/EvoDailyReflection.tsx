import { useEffect, useState } from "react";

import { EvoGuide } from "@/components/EvoGuide";
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
  const greetingIcon = !now || now.getHours() < 12 ? "🌅" : now.getHours() < 18 ? "🌞" : "🌙";
  const displayName = name.trim().split(/\s+/)[0];
  const copy = lang === "pt" ? "pt" : "en";

  return (
    <aside className="hidden min-w-0 border-l border-border pl-5 lg:block">
      <EvoGuide
        title={`${greetingIcon} ${greeting}${displayName ? `, ${displayName}` : ""}`}
        description={`“${reflection.thought[copy]}”`}
        imageSize="dashboard"
      >
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {t("Daily reflection")}
        </p>
        <p className="mt-1 text-sm text-card-foreground">{reflection.reflection[copy]}</p>
      </EvoGuide>
    </aside>
  );
}

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
  const displayName = name.trim().split(/\s+/)[0];

  return (
    <aside className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <EvoGuide
        title={`${greeting}${displayName ? `, ${displayName}` : ""}.`}
        description={t(reflection.thought)}
        imageSize="dashboard"
      >
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {t("Daily reflection")}
        </p>
        <p className="mt-1 text-sm text-card-foreground">{t(reflection.reflection)}</p>
      </EvoGuide>
    </aside>
  );
}
import { Flame } from "lucide-react";

import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export function LearningMomentum({ streakDays }: { streakDays: number }) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  return (
    <aside className="hidden min-w-0 items-center gap-3 border-l border-border pl-5 lg:flex">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary">
        <Flame className="size-5 text-primary" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{t("Your Momentum")}</p>
        {streakDays > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {streakDays} {t(streakDays === 1 ? "day learning streak" : "day learning streaks")}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("Keep building your consistency.")}</p>
        )}
      </div>
    </aside>
  );
}
import { Activity, BarChart3, Compass, Trophy } from "lucide-react";

import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type ProgressSnapshotProps = {
  currentLevel: string;
  strongestSkill: string | null;
  focusNext: string;
  recentlyPractised: boolean;
};

export function ProgressSnapshot({
  currentLevel,
  strongestSkill,
  focusNext,
  recentlyPractised,
}: ProgressSnapshotProps) {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const items = [
    { label: "Current Level", value: currentLevel, icon: BarChart3 },
    {
      label: "Strongest Skill",
      value: strongestSkill ?? t("Building evidence"),
      icon: Trophy,
    },
    { label: "Focus Next", value: focusNext, icon: Compass },
    {
      label: "Learning Momentum",
      value: t(recentlyPractised ? "Consistent" : "Building momentum"),
      icon: Activity,
    },
  ];

  return (
    <aside className="min-w-0 border-t border-border pt-5 lg:col-start-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <h3 className="text-lg font-semibold">{t("My Progress Snapshot")}</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
              <item.icon className="size-4 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase text-muted-foreground">
                {t(item.label)}
              </dt>
              <dd className="mt-0.5 break-words font-medium">{item.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </aside>
  );
}

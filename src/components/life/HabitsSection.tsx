import { Repeat } from "lucide-react";

import { LifeHabitBoard, LifeHabitForm } from "@/components/life/LifeHabits";
import { useLifeT } from "@/components/life/LifeNav";
import { useLife } from "@/hooks/useLife";
import { LIFE_MAX_HABITS } from "@/lib/life";

/** Habits: one check-in a day, the last 7 days editable, with the run of days or weeks. */
export function HabitsSection() {
  const { t } = useLifeT();
  const { data, isLoading, refresh } = useLife();

  if (isLoading || !data) return null;
  // The one page shows a single Premium invitation for these sections.
  if (!data.premium) return null;

  return (
    <section
      id="habits"
      className="card-soft scroll-mt-4 p-4 sm:p-5"
      aria-labelledby="habits-title"
    >
      <div className="flex items-center gap-2">
        <Repeat className="size-5 text-brand-green" aria-hidden="true" />
        <h2 id="habits-title" className="text-base font-semibold">
          {t("Your habits")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {data.habits.length}/{LIFE_MAX_HABITS}
        </span>
      </div>
      {data.habits.length < LIFE_MAX_HABITS ? (
        <div className="mt-4">
          <LifeHabitForm onChange={refresh} />
        </div>
      ) : null}
      <div className="mt-4">
        <LifeHabitBoard
          habits={data.habits}
          logs={data.logs}
          today={data.today}
          onChange={refresh}
        />
      </div>
    </section>
  );
}

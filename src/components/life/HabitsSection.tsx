import { Repeat } from "lucide-react";

import { LifeHabitBoard, LifeHabitForm } from "@/components/life/LifeHabits";
import { LifeAddPanel, LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
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
      className="card-soft scroll-mt-4 p-4 sm:p-5 xl:p-6"
      aria-labelledby="habits-title"
    >
      <LifeSectionTitle
        id="habits-title"
        icon={Repeat}
        accent="violet"
        title={t("Your habits")}
        subtitle={t("One check-in a day")}
        meta={`${data.habits.length}/${LIFE_MAX_HABITS}`}
      />
      <div className="mt-4">
        <LifeHabitBoard
          habits={data.habits}
          logs={data.logs}
          today={data.today}
          onChange={refresh}
        />
      </div>
      {/* The list first, adding one tap away (user request, 2026-10-24); open
          from the start while there is no habit yet. */}
      {data.habits.length < LIFE_MAX_HABITS ? (
        <div className="mt-3">
          <LifeAddPanel label={t("Add habit")} defaultOpen={data.habits.length === 0}>
            {(close) => (
              <LifeHabitForm
                onChange={() => {
                  close();
                  refresh();
                }}
                {...(data.habits.length === 0 ? {} : { onCancel: close })}
              />
            )}
          </LifeAddPanel>
        </div>
      ) : null}
    </section>
  );
}

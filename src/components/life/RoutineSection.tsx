import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { useState } from "react";

import { LifeAddPanel, LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { LifeTaskForm, LifeTaskList } from "@/components/life/LifeTasks";
import { Button } from "@/components/ui/button";
import { useLife } from "@/hooks/useLife";
import { addDays } from "@/lib/life";

function dayLabel(day: string, today: string, lang: "pt" | "en", t: (label: string) => string) {
  if (day === today) return t("Today");
  if (day === addDays(today, 1)) return t("Tomorrow");
  if (day === addDays(today, -1)) return t("Yesterday");
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Routine: the tasks of one day (a week back to a month ahead), by priority.
 * The card is titled "Tasks" with the day under it (user request, 2026-10-24:
 * "Today" competed with the goals' card and changed as the student browsed
 * days), the list first and "+ Add task" under it.
 */
export function RoutineSection() {
  const { t, lang } = useLifeT();
  const { data, isLoading, refresh } = useLife();
  const [offset, setOffset] = useState(0);

  if (isLoading || !data) return null;
  // The one page shows a single Premium invitation for these sections.
  if (!data.premium) return null;

  const day = addDays(data.today, offset);
  const tasks = data.tasks.filter((task) => task.day === day);
  const done = tasks.filter((task) => task.doneAt).length;

  return (
    <section
      id="routine"
      className="card-soft scroll-mt-4 p-4 sm:p-5 xl:p-6"
      aria-labelledby="routine-title"
    >
      <LifeSectionTitle
        id="routine-title"
        icon={ListChecks}
        accent="sky"
        title={t("Tasks")}
        subtitle={<span className="capitalize">{dayLabel(day, data.today, lang, t)}</span>}
        meta={`${done}/${tasks.length}`}
      >
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={t("Previous day")}
            disabled={offset <= -7}
            onClick={() => setOffset((value) => value - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          {offset !== 0 ? (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setOffset(0)}>
              {t("Today")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={t("Next day")}
            disabled={offset >= 30}
            onClick={() => setOffset((value) => value + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </LifeSectionTitle>
      <div className="mt-4">
        <LifeTaskList
          tasks={tasks}
          goals={data.goals}
          onChange={refresh}
          emptyText="No tasks for this day yet."
        />
      </div>
      <div className="mt-3">
        <LifeAddPanel key={day} label={t("Add task")}>
          {(close) => (
            <LifeTaskForm
              day={day}
              goals={data.goals}
              onChange={() => {
                close();
                refresh();
              }}
              onCancel={close}
            />
          )}
        </LifeAddPanel>
      </div>
    </section>
  );
}

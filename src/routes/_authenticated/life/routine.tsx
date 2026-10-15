import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ListChecks, Loader2 } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { LifeNav, LifePremiumGate, useLifeT } from "@/components/life/LifeNav";
import { LifeTaskForm, LifeTaskList } from "@/components/life/LifeTasks";
import { Button } from "@/components/ui/button";
import { useLife } from "@/hooks/useLife";
import { addDays } from "@/lib/life";

export const Route = createFileRoute("/_authenticated/life/routine")({
  head: () => ({
    meta: [
      { title: "Routine - Life AI - Evoluir+ English AI" },
      { name: "description", content: "Plan the tasks of your day with priorities." },
    ],
  }),
  component: RoutinePage,
});

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

/** Routine: the tasks of one day (a week back to a month ahead), by priority. */
function RoutinePage() {
  const { t, lang } = useLifeT();
  const { data, isLoading, refresh } = useLife();
  const [offset, setOffset] = useState(0);

  if (isLoading || !data) {
    return (
      <AppShell>
        <LifeNav active="routine" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </AppShell>
    );
  }
  if (!data.premium) {
    return (
      <AppShell>
        <LifeNav active="routine" />
        <LifePremiumGate feature="Routine" />
      </AppShell>
    );
  }

  const day = addDays(data.today, offset);
  const tasks = data.tasks.filter((task) => task.day === day);
  const done = tasks.filter((task) => task.doneAt).length;

  return (
    <AppShell>
      <LifeNav active="routine" />
      <section className="card-soft p-4 sm:p-5" aria-labelledby="routine-title">
        <div className="flex items-center gap-2">
          <ListChecks className="size-5 text-brand-green" aria-hidden="true" />
          <h2 id="routine-title" className="text-base font-semibold capitalize">
            {dayLabel(day, data.today, lang, t)}
          </h2>
          <span className="text-xs text-muted-foreground">
            {done}/{tasks.length}
          </span>
          <div className="ml-auto flex gap-1">
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
        </div>
        <div className="mt-4">
          <LifeTaskForm key={day} day={day} goals={data.goals} onChange={refresh} />
        </div>
        <div className="mt-4">
          <LifeTaskList
            tasks={tasks}
            goals={data.goals}
            onChange={refresh}
            emptyText="No tasks for this day yet."
          />
        </div>
      </section>
    </AppShell>
  );
}

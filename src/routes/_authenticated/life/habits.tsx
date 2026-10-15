import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Repeat } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { LifeHabitBoard, LifeHabitForm } from "@/components/life/LifeHabits";
import { LifeNav, LifePremiumGate, useLifeT } from "@/components/life/LifeNav";
import { useLife } from "@/hooks/useLife";
import { LIFE_MAX_HABITS } from "@/lib/life";

export const Route = createFileRoute("/_authenticated/life/habits")({
  head: () => ({
    meta: [
      { title: "Habits - Life AI - Evoluir+ English AI" },
      { name: "description", content: "Keep your habits with one check-in a day." },
    ],
  }),
  component: HabitsPage,
});

/** Habits: one check-in a day, the last 7 days editable, with the run of days or weeks. */
function HabitsPage() {
  const { t } = useLifeT();
  const { data, isLoading, refresh } = useLife();

  if (isLoading || !data) {
    return (
      <AppShell>
        <LifeNav active="habits" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </AppShell>
    );
  }
  if (!data.premium) {
    return (
      <AppShell>
        <LifeNav active="habits" />
        <LifePremiumGate feature="Habits" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <LifeNav active="habits" />
      <section className="card-soft p-4 sm:p-5" aria-labelledby="habits-title">
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
    </AppShell>
  );
}

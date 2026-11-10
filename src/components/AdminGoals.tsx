import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getGoalsReport } from "@/lib/admin.functions";
import type { PlusArea } from "@/lib/plus";
import { useUiLang } from "@/lib/uiLang";

const AREA_LABEL: Record<PlusArea, string> = {
  english: "English",
  money: "Money",
  health: "Health",
  other: "Other",
};

/**
 * Admin: what students want to improve besides English, read from the goals
 * they actually created (not from a survey), and which areas they keep up.
 */
export function AdminGoals() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const load = useServerFn(getGoalsReport);
  const query = useQuery({ queryKey: ["admin", "goals"], queryFn: () => load() });
  if (query.isPending) return null;
  if (query.isError) {
    return (
      <p className="mt-4 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        {pt ? "Não foi possível carregar as metas dos alunos." : "Could not load student goals."}
      </p>
    );
  }
  const report = query.data;
  return (
    <section
      className="mt-4 rounded-xl border border-border p-3 sm:p-4"
      aria-label={pt ? "Metas dos alunos" : "Student goals"}
    >
      <p className="text-sm font-semibold">{pt ? "Metas dos alunos" : "Student goals"}</p>
      <p className="text-xs text-muted-foreground">
        {report.activeGoals} metas ativas de {report.students}{" "}
        {pt ? (report.students === 1 ? "aluno" : "alunos") + " · passos dos últimos 30 dias" : (report.students === 1 ? "student" : "students") + " · steps in the last 30 days"}
      </p>

      {report.activeGoals === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {pt ? "Nenhum aluno criou metas ainda. Os números aparecem aqui assim que as primeiras metas forem criadas." : "No students have created goals yet. Results will appear here when the first goals are created."}
        </p>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">{pt ? "Por área" : "By area"}</p>
            <ul className="mt-2 space-y-2">
              {report.byArea.map((row) => (
                <li key={row.area} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{AREA_LABEL[row.area]}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.goals} {row.goals === 1 ? "meta" : "metas"} · {row.percent}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-secondary" aria-hidden="true">
                    <div
                      className="h-2 rounded-full bg-brand-green"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {row.donePercent === null
                      ? pt ? "Sem passos no período" : "No steps during this period"
                      : pt ? `Passos concluídos: ${row.donePercent}% (${row.stepsDone} de ${row.stepsGiven})` : `Steps completed: ${row.donePercent}% (${row.stepsDone} of ${row.stepsGiven})`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Metas mais escritas
            </p>
            <ol className="mt-2 space-y-1 text-sm">
              {report.topTitles.map((item) => (
                <li
                  key={item.title}
                  className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1"
                >
                  <span className="min-w-0 truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.count}×</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

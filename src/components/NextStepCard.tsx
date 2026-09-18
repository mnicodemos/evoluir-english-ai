import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  NEXT_STEP_ACTION_TEXT,
  NEXT_STEP_REASON_TEXT,
  NEXT_STEP_SKILL_TEXT,
} from "@/lib/pedagogy/nextStep";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * Adaptive next step. Everything shown here is decided server-side from the
 * student's own pedagogical data; the card only presents it.
 */
export function NextStepCard() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["next-step"],
    queryFn: () => loadNextStep({ data: undefined }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="card-soft p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
        <Skeleton className="mt-4 h-9 w-40" />
      </section>
    );
  }

  if (isError || !data) return null;

  const skillLabel = data.prioritySkill
    ? t(NEXT_STEP_SKILL_TEXT[data.prioritySkill] ?? data.prioritySkill)
    : t("Free practice");

  return (
    <section className="card-soft p-5" aria-label={t("Your next step")}>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
          <Compass className="size-5 text-[oklch(0.45_0.11_255)]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{t("Your next step")}</h2>
          <p className="mt-0.5 font-medium">{skillLabel}</p>
          <p className="text-sm text-muted-foreground">{t(NEXT_STEP_REASON_TEXT[data.reason])}</p>
          <p className="mt-2 text-sm">
            {t("How to practise")}: <span className="font-medium">{data.activity.title}</span>
          </p>
          {data.activity.params ? (
            <Link
              to="/learning/$lessonId"
              params={data.activity.params}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              {t(NEXT_STEP_ACTION_TEXT[data.action])}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              to={data.activity.to}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              {t(NEXT_STEP_ACTION_TEXT[data.action])}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

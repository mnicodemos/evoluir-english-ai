import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { plusDayComplete } from "@/lib/plus";
import { loadPlus, setPlusStepDone } from "@/lib/plus.functions";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

/**
 * Dashboard (desktop): today's goal steps, ticked right here. It took the row
 * of the old Quick Access, whose links were all in the sidebar already.
 * Shares the Goals page's query, so both stay in step.
 */
export function GoalsTodayCard() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const load = useServerFn(loadPlus);
  const setDone = useServerFn(setPlusStepDone);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["plus", profile?.id ?? null, lang],
    enabled: !!profile,
    queryFn: () => load({ data: { lang } }),
    staleTime: 30 * 1000,
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setDone({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plus"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["qualified-study-days"] });
    },
    onError: () => toast.error(t("The step could not be saved.")),
  });

  const goals = data?.goals ?? [];
  const steps = data?.todaySteps ?? [];
  const allDone = plusDayComplete(steps);

  return (
    <section
      className="card-soft min-w-0 p-3 xl:flex xl:min-h-0 xl:flex-col xl:px-4 xl:py-3"
      aria-labelledby="goals-today-title"
    >
      <div className="flex items-center gap-2">
        <Target
          className="size-[1.65rem] shrink-0 text-brand-green"
          strokeWidth={2.4}
          aria-hidden="true"
        />
        <h2 id="goals-today-title" className="font-display text-sm font-semibold">
          {t("Goals today")}
        </h2>
        {allDone && goals.length > 0 ? (
          <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[11px] font-semibold text-brand-green">
            {t("All done")}
          </span>
        ) : null}
        <Link
          to="/goals"
          className="ml-auto inline-flex items-center gap-1 rounded-md text-[11px] font-semibold leading-none text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
        >
          {t("Open goals")}
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("EVO is preparing today's steps…")}
        </p>
      ) : isError ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("Your goals could not be loaded.")}</p>
      ) : goals.length === 0 ? (
        <div className="mt-2 flex items-center gap-3">
          <EvoAvatar decorative className="size-10 sm:size-10" />
          <p className="min-w-0 flex-1 text-sm">
            {t("Choose 1 to 3 goals and I will give you one small step a day.")}
          </p>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/goals">{t("Choose my goals")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-2 grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-3">
          {goals.map((goal) => {
            const step = steps.find((item) => item.goalId === goal.id);
            const done = !!step?.doneAt;
            return (
              <li key={goal.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={done}
                  disabled={!step || toggle.isPending}
                  onClick={() => step && toggle.mutate({ id: step.id, done: !done })}
                  className={cn(
                    "flex h-full w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors",
                    done ? "bg-brand-green/10" : "bg-secondary/60 hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                      done
                        ? "border-brand-green bg-brand-green text-[oklch(0.2_0.04_160)]"
                        : "border-muted-foreground/60",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0" translate="no">
                    <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                      {goal.title}
                    </span>
                    <span
                      className={cn(
                        "line-clamp-2 text-xs",
                        done && "text-muted-foreground line-through",
                      )}
                    >
                      {step?.text ?? "…"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

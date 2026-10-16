import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Crown,
  Flame,
  Flower2,
  ListChecks,
  Plus,
  Repeat,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/life/guide")({
  head: () => ({
    meta: [
      { title: "How Life AI works - Evoluir+ English AI" },
      {
        name: "description",
        content:
          "A visual guide to Life AI: goals, routine, habits, the Life Coach and meditations.",
      },
    ],
  }),
  component: LifeGuidePage,
});

/** The daily cycle, drawn as a flow (user request: a graphical explanation). */
const CYCLE: { icon: typeof Target; title: string; text: string }[] = [
  { icon: Target, title: "Set your goals", text: "Up to 3 goals, with a deadline and milestones." },
  { icon: Sparkles, title: "EVO gives a step", text: "One small step for each goal, every day." },
  { icon: ListChecks, title: "Plan your day", text: "Your priority and the day's tasks." },
  { icon: Repeat, title: "Keep your habits", text: "One check-in a day builds a run." },
  {
    icon: Flame,
    title: "Your day fills up",
    text: "The ring grows, and the goal steps count for your streak.",
  },
];

type Feature = {
  id: string;
  icon: typeof Target;
  title: string;
  what: string;
  steps: string[];
  premium: boolean;
  art: ReactNode;
};

/**
 * Life AI's own guide (user request): the daily cycle as a diagram and one
 * card per part with a small drawing of its screen, the steps and whether it
 * is free or Premium. Opens from the Life AI header.
 */
function LifeGuidePage() {
  const { t } = useLifeT();

  const features: Feature[] = [
    {
      id: "goals",
      icon: Target,
      title: "Goals",
      what: "What you want beyond English, one step a day.",
      steps: [
        "Write up to 3 goals.",
        "Tick EVO's step of the day.",
        "Add milestones and a deadline to see how far you are.",
      ],
      premium: false,
      art: <GoalsArt t={t} />,
    },
    {
      id: "priority",
      icon: Star,
      title: "Priority of the day",
      what: "The one thing that matters most today.",
      steps: ["Write it in the morning.", "Tick it when it is done."],
      premium: true,
      art: <PriorityArt t={t} />,
    },
    {
      id: "routine",
      icon: ListChecks,
      title: "Routine",
      what: "The tasks of each day, by priority.",
      steps: [
        "Add tasks for today or any day ahead.",
        "Choose high, medium or low and link a goal.",
        "Tick them as you go.",
      ],
      premium: true,
      art: <RoutineArt t={t} />,
    },
    {
      id: "habits",
      icon: Repeat,
      title: "Habits",
      what: "Small actions repeated until they stick.",
      steps: [
        "Choose every day, weekdays or times a week.",
        "Check in once a day; the last 7 days can be fixed.",
        "Watch the flame: days or weeks in a row.",
      ],
      premium: true,
      art: <HabitsArt />,
    },
    {
      id: "coach",
      icon: Sparkles,
      title: "Life Coach",
      what: "EVO helps you plan, in your language.",
      steps: [
        "Ask for a plan or for today's priorities.",
        "EVO answers with your goals and habits in mind.",
        "Add its suggestions with one tap.",
      ],
      premium: true,
      art: <CoachArt t={t} />,
    },
    {
      id: "meditation",
      icon: Flower2,
      title: "Meditations in English",
      what: "Relax and train your listening.",
      steps: [
        "Choose a session; EVO reads it slowly.",
        "Follow the text and see the translation if you need it.",
        "Finish with five key words and one question.",
      ],
      premium: false,
      art: <MeditationArt />,
    },
  ];

  return (
    <AppShell>
      <Link
        to="/life"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Life AI
      </Link>
      <h1 className="mt-2 text-xl font-bold lg:text-3xl">{t("How Life AI works")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Your goals, routine and habits in one place, with EVO as your Life Coach.")}
      </p>

      <section className="card-soft mt-4 p-4 sm:p-5" aria-labelledby="cycle-title">
        <h2 id="cycle-title" className="text-base font-semibold">
          {t("Your daily cycle")}
        </h2>
        <ol className="mt-4 flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          {CYCLE.map((step, index) => {
            const Icon = step.icon;
            return (
              <Fragment key={step.title}>
                <li className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3 lg:flex-col lg:text-center">
                  <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-green/12 text-brand-green">
                    <Icon className="size-5" aria-hidden="true" />
                    <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-brand-green text-[10px] font-bold text-sidebar">
                      {index + 1}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t(step.title)}</span>
                    <span className="block text-xs text-muted-foreground">{t(step.text)}</span>
                  </span>
                </li>
                {index < CYCLE.length - 1 ? (
                  <li aria-hidden="true" className="flex justify-center text-brand-green/70">
                    <ArrowDown className="size-4 lg:hidden" />
                    <ArrowRight className="hidden size-4 lg:block" />
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ol>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <section
              key={feature.id}
              className="card-soft flex flex-col p-4 sm:p-5"
              aria-labelledby={`guide-${feature.id}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-5 text-brand-green" aria-hidden="true" />
                <h2 id={`guide-${feature.id}`} className="text-base font-semibold">
                  {t(feature.title)}
                </h2>
                <span
                  className={cn(
                    "ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    feature.premium
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-brand-green/40 bg-brand-green/10 text-brand-green",
                  )}
                >
                  {feature.premium ? <Crown className="size-3" aria-hidden="true" /> : null}
                  {feature.premium ? "Premium" : t("Free")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t(feature.what)}</p>
              {/* A small drawing of the screen: what the student will see. */}
              <div
                aria-hidden="true"
                className="mt-3 rounded-xl border border-border bg-background/40 p-3"
              >
                {feature.art}
              </div>
              <ol className="mt-3 space-y-1.5 text-sm">
                {feature.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <span>{t(step)}</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Button asChild className="gap-1 bg-brand-green text-sidebar hover:bg-brand-green/90">
          <Link to="/life">
            {t("Open Life AI")}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}

type T = (label: string) => string;

function Tick({ done }: { done?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-full border-2",
        done ? "border-brand-green bg-brand-green text-sidebar" : "border-muted-foreground/50",
      )}
    >
      {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

function GoalsArt({ t }: { t: T }) {
  return (
    <div className="space-y-2 text-xs">
      <p className="font-semibold">{t("Run 5 km")}</p>
      <div className="flex items-center gap-2 rounded-md bg-brand-green/10 p-1.5">
        <Tick done />
        <span className="text-muted-foreground line-through">{t("Walk for 15 minutes")}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
          <span className="block h-full w-2/3 bg-brand-green" />
        </span>
        2/3
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3" />
          {t("{days} days left").replace("{days}", "12")}
        </span>
      </div>
    </div>
  );
}

function PriorityArt({ t }: { t: T }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Star className="size-4 shrink-0 text-amber-400" />
      <Tick />
      <span>{t("Finish the report before lunch")}</span>
    </div>
  );
}

function RoutineArt({ t }: { t: T }) {
  const rows: [string, string, boolean][] = [
    ["Call the bank", "bg-destructive", true],
    ["Read 10 pages", "bg-amber-400", false],
    ["Tidy the desk", "bg-sky-400", false],
  ];
  return (
    <ul className="space-y-1.5 text-xs">
      {rows.map(([label, dot, done]) => (
        <li key={label} className="flex items-center gap-2">
          <Tick done={done} />
          <span className={cn("size-1.5 rounded-full", dot)} />
          <span className={cn(done && "text-muted-foreground line-through")}>{t(label)}</span>
        </li>
      ))}
    </ul>
  );
}

function HabitsArt() {
  const week = [true, true, false, true, true, true, false];
  return (
    <div className="flex items-center gap-1.5">
      {week.map((done, index) => (
        <span
          key={index}
          className={cn(
            "grid size-6 place-items-center rounded-md",
            done ? "bg-brand-green/20 text-brand-green" : "bg-secondary text-muted-foreground/40",
          )}
        >
          {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      ))}
      <span className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-dashboard-cyan">
        <Flame className="size-4" />3
      </span>
    </div>
  );
}

function CoachArt({ t }: { t: T }) {
  return (
    <div className="space-y-1.5 text-xs">
      <p className="ml-auto w-fit rounded-lg rounded-br-sm bg-brand-green/15 px-2 py-1">
        {t("How do I start saving money?")}
      </p>
      <p className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-secondary px-2 py-1">
        {t("Start small: save 10% of what you get this week.")}
      </p>
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
        <Plus className="size-3" />
        <ListChecks className="size-3 text-muted-foreground" />
        {t("Save 10% this week")}
      </span>
    </div>
  );
}

function MeditationArt() {
  const bars = [3, 6, 4, 8, 5, 9, 6, 4, 7, 3, 5, 8, 4, 6, 3];
  return (
    <div className="flex items-center gap-3">
      <Flower2 className="size-5 shrink-0 text-brand-green" />
      <div className="flex h-8 flex-1 items-center gap-0.5">
        {bars.map((height, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-brand-green/60"
            style={{ height: `${height * 10}%` }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{"3 min"}</span>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Briefcase,
  CalendarCheck,
  ChartLine,
  ChevronRight,
  Crown,
  Gem,
  GraduationCap,
  Headphones,
  House,
  Lightbulb,
  MessageSquareText,
  PenLine,
  Settings,
  Sparkles,
  SpellCheck,
  Sprout,
  Trophy,
  Video,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { APP_GUIDE, type GuideIcon } from "@/lib/appGuide";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export const Route = createFileRoute("/_authenticated/guide")({
  head: () => ({
    meta: [
      { title: "App guide - Evoluir+ English AI" },
      { name: "description", content: "How to use each part of Evoluir+, step by step." },
    ],
  }),
  component: GuidePage,
});

const ICONS: Record<GuideIcon, typeof House> = {
  home: House,
  path: GraduationCap,
  vocabulary: BookOpen,
  listening: Headphones,
  writing: PenLine,
  mistakes: SpellCheck,
  speaking: MessageSquareText,
  call: Video,
  teacher: Sparkles,
  life: Sprout,
  plan: CalendarCheck,
  streak: Gem,
  league: Trophy,
  business: Briefcase,
  progress: ChartLine,
  settings: Settings,
};

/**
 * The app guide ("Diário de bordo", user request): one section per main part
 * of the app with what it is for, how to use it step by step, a tip and a
 * button to open it. Content in src/lib/appGuide.ts.
 */
function GuidePage() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);

  return (
    <AppShell>
      <h1 className="text-xl font-bold lg:text-3xl">{t("App guide")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("How to use each part of Evoluir+, step by step.")}
      </p>

      <Accordion type="multiple" className="card-soft mt-4 px-4 sm:px-5">
        {APP_GUIDE.map((section) => {
          const Icon = ICONS[section.icon];
          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              id={section.id}
              className="scroll-mt-4"
            >
              <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-green/12 text-brand-green">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {t(section.title)}
                      {section.premium ? (
                        <Crown className="size-3.5 text-amber-400" aria-label="Premium" />
                      ) : null}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {t(section.what)}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-green">
                  {t("How to use it")}
                </p>
                <ol className="mt-2 space-y-2 text-sm">
                  {section.steps.map((step, index) => (
                    <li key={step} className="flex gap-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold">
                        {index + 1}
                      </span>
                      <span>{t(step)}</span>
                    </li>
                  ))}
                </ol>
                {section.tip ? (
                  <p className="mt-3 flex gap-2 rounded-lg bg-warning/10 p-2.5 text-xs">
                    <Lightbulb className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{t("Tip")}:</span> {t(section.tip)}
                    </span>
                  </p>
                ) : null}
                {section.to ? (
                  <Link
                    to={section.to}
                    className="mt-3 inline-flex items-center gap-0.5 text-sm font-semibold text-brand-green"
                  >
                    {t("Open")} {t(section.title)}
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </AppShell>
  );
}

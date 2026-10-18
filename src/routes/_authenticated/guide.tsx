import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookMarked,
  BookOpen,
  BookOpenText,
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
  Search,
  Settings,
  Sparkles,
  SpellCheck,
  Sprout,
  Trophy,
  Video,
} from "lucide-react";

import { useEffect, useState } from "react";

import { useIsPremium } from "@/components/PremiumBadge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
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
  reading: BookOpenText,
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
  // Premium students see no Premium marks (user request).
  const premium = useIsPremium() !== false;
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  // Search by word (user request): matches the section's title, what it is,
  // its steps and tip, in the language on screen, ignoring accents and case.
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string[]>([]);
  const fold = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const needle = fold(query.trim());
  const sections = needle
    ? APP_GUIDE.filter((section) =>
        fold(
          [section.title, section.what, ...section.steps, section.tip ?? ""]
            .map((text) => t(text))
            .join(" "),
        ).includes(needle),
      )
    : APP_GUIDE;
  // A search opens every section it found, so the matching steps show at once.
  useEffect(() => {
    if (needle) setOpen(sections.map((section) => section.id));
    // sections follows needle; listing it would reopen on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);

  return (
    <AppShell>
      <PageHeader
        icon={BookMarked}
        accent="sky"
        title={t("App guide")}
        description={t("How to use each part of Evoluir+, step by step.")}
      />

      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search the guide, e.g. streak, writing, league")}
          aria-label={t("Search the guide")}
          className="pl-9"
        />
      </div>
      {needle && sections.length === 0 ? (
        <p className="card-soft mt-4 p-4 text-sm text-muted-foreground">
          {t("Nothing found. Try another word.")}
        </p>
      ) : null}

      <Accordion
        type="multiple"
        value={open}
        onValueChange={setOpen}
        className={cn("card-soft mt-4 px-4 sm:px-5", sections.length === 0 && "hidden")}
      >
        {sections.map((section) => {
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
                      {section.premium && !premium ? (
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

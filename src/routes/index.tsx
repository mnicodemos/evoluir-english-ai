import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  
  LineChart,
  MessageSquareText,
  PenLine,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { LANDING_LANG_KEY, landingCopy, type LandingLang } from "@/lib/landingCopy";
import { UI_LANG_KEY } from "@/lib/uiLang";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Your personal AI English teacher" },
      {
        name: "description",
        content:
          "Practice conversation, fix your writing and grow your vocabulary every day with a CELTA-style AI English coach built for Brazilian professionals.",
      },
      { property: "og:title", content: "Evoluir+ English AI · Your personal AI English teacher" },
      {
        property: "og:description",
        content:
          "Practice conversation, fix your writing and grow your vocabulary every day with an AI English coach.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://evoluirmaisenglishai.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://evoluirmaisenglishai.com/" }],
  }),
  component: Landing,
});

const benefitIcons = [MessageSquareText, PenLine, BookOpen, LineChart];
const featureIcons = [MessageSquareText, PenLine, BookOpen];
const stepNumbers = ["01", "02", "03", "04"];

function Landing() {
  const [lang, setLang] = useState<LandingLang>("pt");
  const t = landingCopy[lang];

  // The landing page is always shown in the dark theme.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(LANDING_LANG_KEY);
    if (saved === "pt" || saved === "en") setLang(saved);
  }, []);

  function switchLang(next: LandingLang) {
    setLang(next);
    window.localStorage.setItem(LANDING_LANG_KEY, next);
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <Logo className="size-[1.8rem] shrink-0 self-center" />
            <span className="font-display text-base font-semibold">Evoluir+ English AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => switchLang(lang === "en" ? "pt" : "en")}
              aria-label={lang === "en" ? "Mudar idioma para português" : "Switch language to English"}
              className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {lang === "en" ? "EN" : "PT"}
            </button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">{t.signIn}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t.startFree}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden surface-hero">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center sm:py-28">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/90">
            <Sparkles className="size-3.5" /> {t.badge}
          </span>
          <h1 className="animate-rise mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight text-foreground sm:text-6xl">
            {t.heroTitleA}
            <span className="text-gradient-growth">{t.heroTitleB}</span>
          </h1>
          <p className="animate-rise mx-auto mt-5 max-w-xl text-base text-foreground/70 sm:text-lg">{t.heroText}</p>
          <div className="animate-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t.ctaPrimary} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-foreground/20 bg-foreground/5 text-foreground hover:bg-foreground/10 hover:text-foreground sm:w-auto"
            >
              <Link to="/auth">{t.ctaSecondary}</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-foreground/60">
            {t.trust.map((i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-success" /> {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">{t.whyTitle}</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-foreground">{t.whyText}</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {t.benefits.map((b, i) => {
            const Icon = benefitIcons[i] ?? MessageSquareText;
            return (
              <div key={b.title} className="card-soft p-6 transition-shadow hover:shadow-[var(--shadow-lift)]">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-secondary/60 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{t.howTitle}</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.steps.map((s, i) => (
              <div key={s.title} className="card-soft p-6">
                <span className="font-display text-2xl font-bold text-gradient-growth">{stepNumbers[i]}</span>
                <h3 className="mt-3 font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-foreground/80">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">{t.insideTitle}</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {t.features.map((f, i) => {
            const Icon = featureIcons[i] ?? MessageSquareText;
            return (
              <div key={f.title} className="card-soft p-6">
                <Icon className="size-6 text-[oklch(0.6_0.14_158)]" />
                <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-foreground/80">{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">{t.plansTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-center text-foreground">{t.plansText}</p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
          <div className="card-soft p-7">
            <h3 className="font-semibold text-foreground">{t.free}</h3>
            <p className="mt-1 text-3xl font-bold text-foreground">R$ 0</p>
            <ul className="mt-5 space-y-2 text-sm text-foreground/80">
              {t.freeItems.map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="size-4 text-[oklch(0.6_0.14_158)]" /> {i}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t.ctaPrimary}
              </Link>
            </Button>
          </div>
          <div className="card-soft border-2 border-[oklch(0.6_0.14_158)] p-7">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              {t.premium} <Target className="size-4" />
            </h3>
            <p className="mt-1 text-3xl font-bold text-foreground">
              R$ 79,90<span className="text-base font-medium text-foreground">{t.perMonth}</span>
            </p>
            <p className="mt-1 text-sm text-foreground/80">{t.yearly}</p>
            <ul className="mt-5 space-y-2 text-sm text-foreground/80">
              {t.premiumItems.map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[oklch(0.6_0.14_158)]" /> {i}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t.goPremium}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}

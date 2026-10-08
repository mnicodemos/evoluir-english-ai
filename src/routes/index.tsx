import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import appCoach from "@/assets/home/app-coach.jpg";
import appLearning from "@/assets/home/app-learning.jpg";
import appMistakes from "@/assets/home/app-mistakes.jpg";
import evoImage from "@/assets/evo-landing.webp";
import evoProfile from "@/assets/evo-profile.jpg.asset.json";
import { Footer } from "@/components/Footer";
import { LaunchCampaignPopup } from "@/components/home/LaunchCampaignPopup";
import { BrandName } from "@/components/BrandName";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const SITE_URL = "https://evoluirmaisenglishai.com/";
const OG_IMAGE = `${SITE_URL}og-image.jpg`;
const TITLE = "Evoluir+ English AI | Aprenda inglês com inteligência artificial";
const DESCRIPTION =
  "App de inglês com IA: converse por voz com a EVO, tenha seus textos corrigidos na hora e siga uma trilha do A1 ao C2 com revisão dos seus próprios erros.";

/** Organization + app description for search engines (no prices or ratings claimed). */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Evoluir+ English AI",
      url: SITE_URL,
      logo: `${SITE_URL}icon-512.png`,
    },
    {
      "@type": "WebApplication",
      name: "Evoluir+ English AI",
      url: SITE_URL,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web, Android, iOS",
      inLanguage: "pt-BR",
      description: DESCRIPTION,
    },
  ],
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "EVO, a professora de inglês com IA do Evoluir+" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(STRUCTURED_DATA) }],
  }),
  component: CommercialLanding,
});

const journey = [
  ["01", "DESCUBRA", "Entenda seu nível e suas habilidades."],
  ["02", "PRIORIZE", "Saiba o que merece atenção agora."],
  ["03", "PRATIQUE", "Use o inglês em situações reais."],
  ["04", "EVOLUA", "Seu progresso orienta o próximo passo."],
] as const;

const productScreens = [
  {
    image: appLearning,
    title: "Sua trilha",
    text: "Conteúdo adequado ao seu nível, do A1 ao C2.",
  },
  {
    image: appCoach,
    title: "Converse com a EVO",
    text: "Pratique inglês em situações reais.",
  },
  {
    image: appMistakes,
    title: "Transforme erros em evolução",
    text: "Revise o que precisa melhorar.",
  },
] as const;

function CommercialLanding() {
  return (
    <div className="dashboard-shell brand-dashboard-theme dark min-h-screen overflow-x-clip bg-background text-foreground">
      <LaunchCampaignPopup />
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="Evoluir+ English AI — início"
            className="flex min-w-0 items-center gap-2.5"
          >
            <Logo className="size-10 shrink-0 lg:size-[3.32rem]" />
            <BrandName className="truncate text-sm sm:text-base" />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/auth" search={{ mode: "signin" }}>
                Entrar
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Começar <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="snap-y snap-mandatory overflow-y-auto scroll-smooth">
        {/* TELA 1 — HOOK */}
        <section className="relative min-h-[calc(100svh-4rem)] snap-start overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 surface-hero opacity-45" aria-hidden="true" />

          <div className="relative mx-auto grid h-full min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-4 px-4 py-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-0">
            <div className="z-10 max-w-2xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-success sm:mb-5">
                Evoluir+ English AI
              </p>

              <h1 className="text-[2.15rem] font-bold leading-[1.04] sm:text-5xl lg:text-[4.25rem]">
                Você sabe seu nível de inglês.
                <span className="mt-2 block text-gradient-growth">
                  Mas sabe o que precisa melhorar agora?
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
                O Evoluir+ entende sua evolução, acompanha suas habilidades e ajuda você a descobrir
                onde concentrar sua prática.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Conhecer o Evoluir+ <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <span className="text-center text-xs text-muted-foreground sm:px-2">
                  Entre gratuitamente
                </span>
              </div>
            </div>

            <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[620px] items-end justify-center lg:self-end">
              <div
                className="absolute bottom-[12%] left-1/2 h-24 w-2/3 -translate-x-1/2 rounded-full bg-success/10 blur-3xl"
                aria-hidden="true"
              />
              <img
                src={evoImage}
                alt="EVO, a companheira inteligente da sua evolução em inglês"
                width={848}
                height={1264}
                fetchPriority="high"
                className="relative h-[58vh] max-h-[690px] w-full object-contain object-bottom drop-shadow-2xl lg:h-[88vh]"
              />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 sm:block">
            Role para descobrir
          </div>
        </section>

        {/* TELA 2 — DOR + DIREÇÃO */}
        <section className="min-h-[calc(100svh-4rem)] snap-start border-b border-border/70 bg-secondary/25">
          <div className="mx-auto grid h-full min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-success">
                Talvez seja isso
              </p>
              <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
                Talvez você não precise estudar mais.
                <span className="mt-2 block text-success">Precise de direção.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
                Você pode aprender conteúdo, praticar e ainda assim não saber onde concentrar seu
                esforço. O Evoluir+ transforma seu momento de aprendizagem em um próximo passo
                concreto.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                ["Seu nível", "B2", "Onde você está agora"],
                ["Suas habilidades", "Grammar · Vocabulary · Speaking", "O que já foi demonstrado"],
                ["Seu próximo passo", "Praticar Speaking", "O que faz sentido agora"],
              ].map(([label, value, detail], index) => (
                <div key={label} className="card-soft relative overflow-hidden p-5 sm:p-6">
                  <div
                    className="absolute left-0 top-0 h-full w-1 bg-success/70"
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-2 text-base font-bold sm:text-xl">{value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                    </div>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-xs font-bold text-success">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TELA 3 — MECANISMO */}
        <section className="min-h-[calc(100svh-4rem)] snap-start border-b border-border/70">
          <div className="mx-auto flex h-full min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-success">
                Como funciona
              </p>
              <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
                Seu aprendizado acompanha você.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
                A experiência começa no que você já sabe e continua a partir do que precisa
                desenvolver.
              </p>
            </div>

            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-5">
              {journey.map(([number, title, text]) => (
                <li key={number} className="card-soft p-5 sm:p-6">
                  <span className="text-3xl font-bold text-success">{number}</span>
                  <h3 className="mt-4 text-sm font-bold tracking-wide">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-7 border-l-2 border-success pl-4 text-sm font-medium text-foreground sm:mt-10 sm:text-base">
              O objetivo não é colocar mais conteúdo na sua frente.
              <span className="text-success"> É ajudar você a saber o que fazer a seguir.</span>
            </div>
          </div>
        </section>

        {/* TELA 4 — PRODUTO */}
        <section className="min-h-[calc(100svh-4rem)] snap-start border-b border-border/70 bg-secondary/40">
          <div className="mx-auto flex h-full min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-success">
                  Por dentro do app
                </p>
                <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
                  Não é promessa. É o produto.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-right">
                Conheça algumas das experiências que transformam direção em prática.
              </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-5">
              {productScreens.map((screen) => (
                <figure key={screen.title} className="card-soft overflow-hidden">
                  <img
                    src={screen.image}
                    alt={`Tela do Evoluir+: ${screen.title}`}
                    width={1069}
                    height={715}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[1069/715] w-full border-b border-border bg-background object-cover object-top"
                  />
                  <figcaption className="p-4 sm:p-5">
                    <h3 className="text-sm font-bold sm:text-base">{screen.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {screen.text}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-3 text-[10px] text-muted-foreground">
              Telas reais do app, com dados de demonstração.
            </p>
          </div>
        </section>

        {/* TELA 5 — CTA */}
        <section className="relative min-h-[calc(100svh-4rem)] snap-start overflow-hidden">
          <div className="absolute inset-0 surface-hero opacity-55" aria-hidden="true" />

          <div className="relative mx-auto grid h-full min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.7fr] lg:px-8">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-success">
                More than English
              </p>
              <h2 className="text-4xl font-bold leading-[1.06] sm:text-6xl">
                Seu próximo passo
                <span className="block text-gradient-growth">começa aqui.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
                Conheça uma experiência de aprendizagem que acompanha seu nível, sua prática e sua
                evolução.
              </p>
              <Button asChild size="lg" className="mt-7 min-h-12 w-full sm:w-auto">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Conhecer o Evoluir+ <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Entre gratuitamente e conheça o app.
              </p>
            </div>

            <div className="relative mx-auto hidden h-full w-full max-w-[390px] items-end justify-center sm:flex">
              <img
                src={evoImage}
                alt=""
                width={848}
                height={1264}
                loading="lazy"
                decoding="async"
                className="h-[68vh] max-h-[650px] w-full object-contain object-bottom drop-shadow-2xl"
                aria-hidden="true"
              />
            </div>
          </div>
        </section>
      </main>

      <Footer lang="pt" />
    </div>
  );
}

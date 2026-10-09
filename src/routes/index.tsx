import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Flag,
  GraduationCap,
  Mic,
  PenLine,
  SpellCheck,
  Video,
} from "lucide-react";

import appCoach from "@/assets/home/app-coach.jpg";
import appLearning from "@/assets/home/app-learning.jpg";
import appMistakes from "@/assets/home/app-mistakes.jpg";
import evoImage from "@/assets/evo-landing.webp";
import { Footer } from "@/components/Footer";
import { LaunchCampaignBadge, LaunchCampaignPopup } from "@/components/home/LaunchCampaignPopup";
import { BrandName } from "@/components/BrandName";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { bumpLandingStat } from "@/lib/landingStats";

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

// What the app really does, each one a screen students already use.
const strengths = [
  {
    icon: Mic,
    title: "Conversa por voz com a EVO",
    text: "Fale sobre o seu dia ou treine entrevista, reunião e viagem. Ela responde e ajusta seu inglês.",
  },
  {
    icon: Video,
    title: "Chamada de vídeo",
    text: "Um papo informal com a EVO, como com uma amiga, para perder o medo de falar.",
  },
  {
    icon: PenLine,
    title: "Correção de textos na hora",
    text: "Escreva e veja o que ajustar, com a explicação do porquê.",
  },
  {
    icon: SpellCheck,
    title: "Seus erros viram revisão",
    text: "O que você errou volta no momento certo, até virar acerto.",
  },
  {
    icon: GraduationCap,
    title: "Trilha do A1 ao C2",
    text: "Lições do seu nível, teste final e avanço de nível com o seu progresso guardado.",
  },
  {
    icon: BookOpen,
    title: "Vocabulário que não se perde",
    text: "Revisão espaçada: cada palavra volta no dia certo para ficar na memória.",
  },
] as const;

const steps = [
  ["1", "Teste de nível rápido", "Descubra onde você está, do A1 ao C2."],
  ["2", "Fale com a EVO no primeiro dia", "Sua primeira conversa começa logo após o teste."],
  ["3", "Um próximo passo por dia", "A EVO mostra a habilidade que mais precisa de atenção agora."],
] as const;

const productScreens = [
  {
    image: appCoach,
    title: "Converse com a EVO",
    text: "Situações reais, por voz.",
  },
  {
    image: appLearning,
    title: "Sua trilha",
    text: "Conteúdo do seu nível, do A1 ao C2.",
  },
  {
    image: appMistakes,
    title: "Meus erros",
    text: "Revise o que precisa melhorar.",
  },
] as const;

const faq = [
  [
    "Preciso de cartão para começar?",
    "Não. Você cria sua conta e começa a usar o app sem cadastrar cartão.",
  ],
  [
    "Serve para quem está começando do zero?",
    "Sim. O teste de nível encontra o seu ponto de partida, e a trilha começa no A1 se for o caso.",
  ],
  [
    "Quanto tempo preciso por dia?",
    "Você escolhe sua meta diária no início. Poucos minutos por dia já contam para sua sequência.",
  ],
  [
    "Funciona no celular?",
    "Sim. O Evoluir+ funciona no navegador do celular e do computador, sem instalar nada.",
  ],
] as const;

const countSignupClick = () => bumpLandingStat("signup_click");

function CommercialLanding() {
  useEffect(() => bumpLandingStat("visit"), []);
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
              <Link to="/auth" search={{ mode: "signup" }} onClick={countSignupClick}>
                Começar <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO — what it is, for whom, and the first step */}
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 surface-hero opacity-45" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-8 lg:pt-10">
            <div className="z-10 max-w-2xl pb-2 lg:pb-12">
              <LaunchCampaignBadge className="mb-4" />
              <h1 className="text-[2.15rem] font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                Fale inglês sem travar.
                <span className="mt-2 block text-gradient-growth">
                  Pratique com a EVO, sua professora de IA.
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-lg">
                Converse por voz a qualquer hora, tenha seus textos corrigidos na hora e siga uma
                trilha do A1 ao C2 que mostra o que melhorar agora.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
                  <Link to="/auth" search={{ mode: "signup" }} onClick={countSignupClick}>
                    Começar grátis <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <span className="text-center text-xs text-muted-foreground sm:px-2">
                  Teste de nível rápido · sem cartão
                </span>
              </div>

              <ul className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
                {[
                  "Conversa por voz",
                  "Correção na hora",
                  "Do A1 ao C2",
                  "Mais que inglês: Metas",
                ].map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5"
                  >
                    <Check className="size-3.5 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto flex w-full max-w-[460px] items-end justify-center self-end">
              <div
                className="absolute bottom-[10%] left-1/2 h-24 w-2/3 -translate-x-1/2 rounded-full bg-success/10 blur-3xl"
                aria-hidden="true"
              />
              <img
                src={evoImage}
                alt="EVO, a professora de inglês com IA do Evoluir+"
                width={848}
                height={1264}
                fetchPriority="high"
                className="relative h-[30vh] max-h-[560px] w-full object-contain object-bottom drop-shadow-2xl sm:h-[42vh] lg:h-[64vh]"
              />
            </div>
          </div>
        </section>

        {/* FORTALEZAS — the real features, side by side */}
        <section className="border-b border-border/70 bg-secondary/25">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-success">
              O que você encontra no Evoluir+
            </p>
            <h2 className="max-w-3xl text-2xl font-bold leading-tight sm:text-4xl">
              Tudo o que faltava para você usar o inglês de verdade.
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {strengths.map(({ icon: Icon, title, text }) => (
                <li key={title} className="card-soft flex gap-3 p-4 sm:p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold sm:text-base">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Metas: the "More than English" difference, in full width */}
            <div className="card-soft mt-3 flex flex-col gap-3 border-success/40 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 lg:mt-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
                <Flag className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-warning">
                  More than English
                </p>
                <h3 className="mt-0.5 text-base font-bold sm:text-lg">
                  Metas além do inglês, na mesma rotina
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Escolha até 3 metas pessoais (carreira, saúde, finanças) e receba da EVO um
                  pequeno passo por dia. Cada dia cumprido conta na sua sequência de estudo e na
                  liga semanal.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUTO + COMO FUNCIONA */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-success">
                  Por dentro do app
                </p>
                <h2 className="text-2xl font-bold leading-tight sm:text-4xl">
                  Não é promessa. É o produto.
                </h2>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground sm:text-right sm:text-sm">
                Telas reais do app, com dados de demonstração.
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
                  <figcaption className="p-4">
                    <h3 className="text-sm font-bold sm:text-base">{screen.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {screen.text}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>

            <h2 className="mt-10 text-xl font-bold sm:text-2xl">Como funciona</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:gap-4">
              {steps.map(([number, title, text]) => (
                <li key={number} className="card-soft flex gap-3 p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/12 text-sm font-bold text-success">
                    {number}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-border/70 bg-secondary/25">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            <h2 className="text-xl font-bold sm:text-2xl">Perguntas frequentes</h2>
            <div className="mt-4 grid gap-2">
              {faq.map(([question, answer]) => (
                <details key={question} className="card-soft group p-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {question}
                      <ArrowRight
                        className="size-4 shrink-0 text-success transition-transform group-open:rotate-90"
                        aria-hidden="true"
                      />
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 surface-hero opacity-55" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-12 text-center sm:px-6 lg:py-16">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-success">
              More than English
            </p>
            <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
              Sua primeira conversa com a EVO
              <span className="block text-gradient-growth">começa hoje.</span>
            </h2>
            <Button asChild size="lg" className="mt-6 min-h-12 w-full sm:w-auto">
              <Link to="/auth" search={{ mode: "signup" }} onClick={countSignupClick}>
                Começar grátis <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Teste de nível rápido · sem cartão</p>
          </div>
        </section>
      </main>

      <Footer lang="pt" />
    </div>
  );
}

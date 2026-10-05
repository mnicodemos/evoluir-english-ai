import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  BriefcaseBusiness,
  CalendarCheck,
  CircleAlert,
  Ear,
  GraduationCap,
  Mail,
  MessageCircleMore,
  Mic2,
  PenLine,
  ShieldCheck,
  Snowflake,
  Sparkles,
  SpellCheck,
  Trophy,
  Users,
} from "lucide-react";

import appCoach from "@/assets/home/app-coach.jpg";
import appLearning from "@/assets/home/app-learning.jpg";
import appMistakes from "@/assets/home/app-mistakes.jpg";
import appWriting from "@/assets/home/app-writing.jpg";
import evoImage from "@/assets/evo-landing.webp";
import evoProfile from "@/assets/evo-profile.jpg.asset.json";
import { Footer } from "@/components/Footer";
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

const problems = [
  "Você estuda, mas não sabe o que priorizar.",
  "Você aprende conteúdo, mas nem sempre consegue usá-lo em situações reais.",
  "Você pratica, mas nem sempre consegue perceber sua evolução.",
];

const journey = [
  ["01", "DESCUBRA", "Entenda seu nível e suas necessidades."],
  ["02", "APRENDA", "Estude conteúdos adequados ao seu momento."],
  ["03", "PRATIQUE", "Use o inglês em diferentes situações."],
  ["04", "EVOLUA", "Receba orientação sobre o que faz sentido trabalhar a seguir."],
] as const;

const evoMessages = [
  "Encontrei seu próximo passo.",
  "Vamos reforçar essa habilidade?",
  "Você já demonstrou evolução aqui.",
  "Agora vamos usar essa habilidade em outro contexto.",
];

/** Screens of the real app, captured with demonstration data. */
const screens = [
  {
    image: appLearning,
    title: "Trilha do seu nível, do A1 ao C2",
    text: "Lições com vídeo, resumo, flashcards, quiz e prática guiada. A próxima lição sempre à vista.",
  },
  {
    image: appCoach,
    title: "Converse por voz com a EVO",
    text: "Fale de verdade, em situações reais: entrevista de emprego, reunião, hotel, restaurante.",
  },
  {
    image: appWriting,
    title: "Escrita corrigida na hora",
    text: "Seu texto corrigido, uma versão natural e notas de gramática, vocabulário e clareza.",
  },
  {
    image: appMistakes,
    title: "Seus erros viram revisão",
    text: "Os erros das suas correções voltam em revisão espaçada até você acertar de vez.",
  },
] as const;

const heroProofs = [
  [AudioLines, "Conversa por voz com IA"],
  [PenLine, "Correção de escrita"],
  [GraduationCap, "Trilha A1–C2"],
] as const;

const extras = [
  [SpellCheck, "Meus erros com revisão espaçada"],
  [Mail, "Relatório semanal da EVO"],
  [ShieldCheck, "Seus dados não aparecem para outros alunos sem permissão"],
] as const;

const features = [
  [
    Ear,
    "Listening com shadowing",
    "Ouça frases reais, repita e fale junto com o áudio para pegar o ritmo.",
  ],
  [Mic2, "Pronúncia por som", "Veja qual parte da palavra saiu diferente, não só uma porcentagem."],
  [
    MessageCircleMore,
    "Situações reais",
    "Role-plays com a EVO escolhidos pelo objetivo do seu plano.",
  ],
  [
    CalendarCheck,
    "Plano de estudo semanal",
    "Um plano pelo seu objetivo, tempo disponível e foco.",
  ],
  [Trophy, "Liga semanal", "Ranking opcional com alunos do seu nível. Participa quem quiser."],
  [Snowflake, "Proteção do Streak", "Faltou um dia na semana? Sua sequência continua."],
] as const;

const audiences = [
  [BriefcaseBusiness, "PROFISSIONAIS", "Para quem precisa usar inglês no trabalho."],
  [
    GraduationCap,
    "ESTUDANTES",
    "Para quem quer desenvolver suas habilidades de forma estruturada.",
  ],
  [
    Users,
    "QUEM JÁ ESTUDOU INGLÊS",
    "Para quem sente que estuda há anos, mas ainda não evolui como gostaria.",
  ],
  [Mic2, "QUEM QUER PRATICAR", "Para quem quer transformar conhecimento em uso real."],
] as const;

function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? <p className="mb-4 text-xs font-bold uppercase text-success">{eyebrow}</p> : null}
      <h2 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
        {title}
      </h2>
    </div>
  );
}

function CommercialLanding() {
  return (
    <div className="dashboard-shell brand-dashboard-theme dark min-h-screen overflow-x-clip bg-background text-foreground">
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

      <main>
        <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 surface-hero opacity-45" aria-hidden="true" />
          <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-6 px-4 pb-0 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-10">
            <div className="z-10 max-w-3xl pb-12 lg:pb-20">
              <p className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase text-success">
                <Sparkles className="size-4" aria-hidden="true" /> App de inglês com inteligência
                artificial
              </p>
              <h1 className="text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl">
                Seu inglês não segue um curso.
                <span className="mt-2 block text-gradient-growth">Ele evolui com você.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl">
                Converse por voz com a EVO, tenha seus textos corrigidos na hora e siga uma trilha
                do A1 ao C2 no seu ritmo, revisando os seus próprios erros até acertar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Descubra seu próximo passo <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-h-12 w-full bg-background/40 sm:w-auto"
                >
                  <a href="#por-dentro">
                    Veja o app por dentro <ArrowDown aria-hidden="true" />
                  </a>
                </Button>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {heroProofs.map(([Icon, label]) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <Icon className="size-4 text-success" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto flex h-[519px] w-full max-w-[718px] items-end justify-center sm:h-[718px] lg:h-[904px] lg:self-end">
              <div
                className="absolute bottom-[13%] left-1/2 h-[18%] w-[62%] -translate-x-1/2 rounded-full bg-success/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative h-full w-full">
                <img
                  src={evoImage}
                  alt="EVO, a companheira inteligente da sua evolução em inglês"
                  width={848}
                  height={1264}
                  fetchPriority="high"
                  className="absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 py-10 sm:py-14">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <SectionHeading title="Você já estudou inglês. Mas será que seu estudo está fazendo você evoluir?" />
            <div>
              <div className="space-y-4">
                {problems.map((problem) => (
                  <div
                    key={problem}
                    className="card-soft flex items-start gap-4 p-5 text-card-foreground sm:p-6"
                  >
                    <CircleAlert
                      className="mt-0.5 size-5 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <p className="leading-relaxed text-card-foreground">{problem}</p>
                  </div>
                ))}
              </div>
              <p className="mt-8 border-l-2 border-success pl-5 text-xl font-semibold leading-relaxed sm:text-2xl">
                O problema nem sempre é falta de estudo.
                <span className="block text-success">Pode ser falta de direção.</span>
              </p>
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="scroll-mt-20 border-y border-border/70 py-10 sm:py-14"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Como funciona" title="Uma jornada que evolui com você." />
            <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {journey.map(([number, title, text]) => (
                <li key={number} className="relative border-t border-border pt-6">
                  <span className="font-display text-3xl font-bold text-success">{number}</span>
                  <h3 className="mt-5 text-sm font-bold">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="por-dentro" className="scroll-mt-20 bg-secondary/40 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Por dentro do app" title="Veja como é estudar no Evoluir+." />
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {screens.map((screen) => (
                <figure key={screen.title} className="card-soft overflow-hidden">
                  <img
                    src={screen.image}
                    alt={`Tela do Evoluir+: ${screen.title}`}
                    width={1069}
                    height={715}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[1069/715] w-full border-b border-border bg-background object-contain object-top"
                  />
                  <figcaption className="p-5">
                    <h3 className="font-semibold text-card-foreground">{screen.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {screen.text}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Telas reais do app, com dados de demonstração.
            </p>
          </div>
        </section>

        <section className="overflow-hidden py-10 sm:py-14">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.12fr_0.72fr] lg:px-8">
            <div className="relative mx-auto aspect-[3/2] w-full max-w-[470px] overflow-hidden rounded-lg">
              <img
                src={evoProfile.url}
                alt="EVO apresentando orientações personalizadas de aprendizagem"
                width={1536}
                height={1024}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="max-w-xl">
                <p className="mb-3 text-xs font-bold uppercase text-success">
                  Sua companheira de evolução
                </p>
                <h2 className="text-2xl font-bold leading-tight text-foreground sm:text-[1.75rem]">
                  Conheça a EVO.
                </h2>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Sua companheira inteligente de evolução em inglês.
              </p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {evoMessages.map((message, index) => (
                  <div key={message} className="card-soft p-3.5 text-card-foreground">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-success">
                      <Logo className="size-[1.1rem]" /> EVO {String(index + 1).padStart(2, "0")}
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-card-foreground">
                      “{message}”
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-secondary/40 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Recursos" title="Tudo para praticar um pouco todos os dias." />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(([Icon, title, text]) => (
                <article key={title} className="card-soft flex gap-4 p-5 text-card-foreground">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </article>
              ))}
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {extras.map(([Icon, label]) => (
                <li key={label} className="flex items-center gap-1.5">
                  <Icon className="size-4 text-success" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-border/70 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title="Para quem quer evoluir de verdade no inglês." />
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {audiences.map(([Icon, title, text]) => (
                <article
                  key={title}
                  className="card-soft flex gap-4 p-5 text-card-foreground sm:p-6"
                >
                  <span className="grid size-11 shrink-0 place-items-center text-primary">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-card-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-12 sm:py-16">
          <div className="absolute inset-0 surface-hero opacity-50" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Logo className="mx-auto size-[3.75rem]" />
            <h2 className="mt-7 text-3xl font-bold leading-tight sm:text-5xl">
              Descubra qual é o seu próximo passo.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-muted-foreground sm:text-lg">
              Comece sua jornada e descubra como o Evoluir+ pode orientar seu aprendizado de inglês.
            </p>
            <Button asChild size="lg" className="mt-8 min-h-12 w-full sm:w-auto">
              <Link to="/auth" search={{ mode: "signup" }}>
                Começar agora <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer lang="pt" />
    </div>
  );
}

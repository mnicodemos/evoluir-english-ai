import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  BookOpenText,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  Ear,
  GraduationCap,
  Languages,
  MessageCircleMore,
  Mic2,
  PenLine,
  RouteIcon,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Volume2,
} from "lucide-react";

import evoImage from "@/assets/evo-landing.png";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI | Seu inglês evolui com você" },
      {
        name: "description",
        content:
          "Aprenda, pratique e acompanhe sua evolução em inglês com uma jornada personalizada pelo Evoluir+ English AI.",
      },
      { property: "og:title", content: "Evoluir+ English AI | Seu inglês evolui com você" },
      {
        property: "og:description",
        content:
          "Aprenda, pratique e acompanhe sua evolução em inglês com uma jornada personalizada pelo Evoluir+ English AI.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://evoluirmaisenglishai.com/landing" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://evoluirmaisenglishai.com/landing" }],
  }),
  component: CommercialLanding,
});

const problems = [
  "Você estuda, mas não sabe o que priorizar.",
  "Você aprende conteúdo, mas nem sempre consegue usá-lo em situações reais.",
  "Você pratica, mas nem sempre consegue perceber sua evolução.",
];

const pillars = [
  {
    icon: Compass,
    title: "DIAGNÓSTICO",
    text: "Entenda suas habilidades e pontos que precisam de atenção.",
  },
  {
    icon: RouteIcon,
    title: "PLANO PERSONALIZADO",
    text: "Tenha uma jornada orientada para seu objetivo.",
  },
  {
    icon: Target,
    title: "PRÁTICA",
    text: "Aprenda e pratique dentro da mesma experiência.",
  },
  {
    icon: TrendingUp,
    title: "EVOLUÇÃO",
    text: "Acompanhe evidências da sua evolução.",
  },
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

const skills = [
  [Ear, "Listening"],
  [MessageCircleMore, "Speaking"],
  [PenLine, "Writing"],
  [BookOpenText, "Vocabulary"],
  [Volume2, "Pronunciation"],
  [Languages, "Reading"],
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
    <div className="dark min-h-screen overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to="/landing"
            aria-label="Evoluir+ English AI — início"
            className="flex min-w-0 items-center gap-2.5"
          >
            <Logo className="size-8 shrink-0" />
            <span className="truncate font-display text-sm font-semibold sm:text-base">
              Evoluir+ English AI
            </span>
          </Link>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/auth" search={{ mode: "signup" }}>
              Começar <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 surface-hero opacity-45" aria-hidden="true" />
          <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-6 px-4 pb-0 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-10">
            <div className="z-10 max-w-3xl pb-12 lg:pb-20">
              <p className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase text-success">
                <Sparkles className="size-4" aria-hidden="true" /> Uma jornada feita para você
              </p>
              <h1 className="text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl">
                Seu inglês não segue um curso.
                <span className="mt-2 block text-gradient-growth">Ele evolui com você.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl">
                Descubra o que você realmente precisa melhorar, pratique de forma personalizada e
                acompanhe sua evolução em inglês.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    DESCUBRA SEU PRÓXIMO PASSO <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-h-12 w-full bg-background/40 sm:w-auto"
                >
                  <a href="#como-funciona">
                    CONHEÇA O EVOLUIR+ <ArrowDown aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="relative mx-auto flex h-[390px] w-full max-w-[540px] items-end justify-center sm:h-[540px] lg:h-[680px] lg:self-end">
              <div
                className="absolute bottom-[13%] left-1/2 h-[18%] w-[62%] -translate-x-1/2 rounded-full bg-success/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative h-full w-full">
                <img
                  src={evoImage}
                  alt="EVO, a companheira inteligente da sua evolução em inglês"
                  width={1024}
                  height={1400}
                  fetchPriority="high"
                  className="absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-2xl"
                />
                <Logo className="absolute left-[56.5%] top-[22.3%] size-[5.7%] min-h-5 min-w-5 shadow-lg" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <SectionHeading title="Você já estudou inglês. Mas será que seu estudo está fazendo você evoluir?" />
            <div>
              <div className="space-y-4">
                {problems.map((problem) => (
                  <div key={problem} className="card-soft flex items-start gap-4 p-5 sm:p-6">
                    <CheckCircle2
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

        <section className="bg-secondary/40 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="O diferencial" title="Não é apenas sobre estudar inglês." />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map(({ icon: Icon, title, text }) => (
                <article key={title} className="card-soft p-6">
                  <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-sm font-bold text-foreground">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="scroll-mt-20 border-y border-border/70 py-20 sm:py-28"
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

        <section className="overflow-hidden bg-secondary/40 py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div className="relative mx-auto h-[420px] w-full max-w-[400px] sm:h-[520px]">
              <img
                src={evoImage}
                alt="EVO apresentando orientações personalizadas de aprendizagem"
                width={1024}
                height={1400}
                loading="lazy"
                className="h-full w-full object-contain object-bottom"
              />
              <Logo className="absolute left-[56.5%] top-[22.3%] size-[5.7%] min-h-5 min-w-5 shadow-lg" />
            </div>
            <div>
              <SectionHeading eyebrow="Sua companheira de evolução" title="Conheça a EVO." />
              <p className="mt-5 text-lg text-muted-foreground">
                Sua companheira inteligente de evolução em inglês.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {evoMessages.map((message, index) => (
                  <div key={message} className="card-soft p-5">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-success">
                      <Logo className="size-5" /> EVO {String(index + 1).padStart(2, "0")}
                    </div>
                    <p className="text-sm font-medium leading-relaxed">“{message}”</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <SectionHeading title="Aprender inglês é mais do que acertar exercícios." />
              <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
                O Evoluir+ considera sua jornada de aprendizagem para orientar os próximos passos,
                em vez de simplesmente contar quantas atividades você realizou.
              </p>
            </div>
            <div className="card-soft p-5 sm:p-8" aria-label="Caminho da evidência até a evolução">
              {["Evidência", "Prática", "Contexto", "Evolução"].map((item, index, array) => (
                <div key={item}>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/60 p-4">
                    <span className="font-display font-semibold">{item}</span>
                    {index === array.length - 1 ? (
                      <Sparkles className="size-5 text-success" aria-hidden="true" />
                    ) : (
                      <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
                    )}
                  </div>
                  {index < array.length - 1 ? (
                    <ArrowDown
                      className="mx-auto my-2 size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Habilidades"
              title="Uma experiência. Diferentes habilidades."
            />
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {skills.map(([Icon, label]) => (
                <div key={label} className="card-soft flex min-h-32 flex-col justify-between p-5">
                  <Icon className="size-6 text-success" aria-hidden="true" />
                  <h3 className="mt-8 text-sm font-semibold">{label}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary/40 py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <SectionHeading eyebrow="Seu progresso" title="Veja sua evolução ganhar forma." />
              <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
                Visualize o que você já conquistou, onde está agora e qual caminho faz sentido
                seguir.
              </p>
            </div>
            <div
              className="card-soft overflow-hidden"
              aria-label="Exemplo visual da área de evolução, sem dados pessoais"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Minha evolução
                  </p>
                  <p className="mt-1 font-display font-semibold">Evidências da sua jornada</p>
                </div>
                <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
                  <TrendingUp className="size-5" aria-hidden="true" />
                </span>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                {[
                  "Você evoluiu em",
                  "Você consolidou",
                  "Continue praticando",
                  "Seu próximo passo",
                ].map((label, index) => (
                  <div key={label} className="rounded-lg border border-border bg-secondary/60 p-4">
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <div className="mt-5 flex items-end gap-2" aria-hidden="true">
                      {[42, 68, 54, 82, 66].map((height, barIndex) => (
                        <span
                          key={barIndex}
                          className={`w-full rounded-sm ${barIndex === index ? "bg-warning" : "bg-success/60"}`}
                          style={{ height: `${height / 2}px` }}
                        />
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Baseado na sua própria prática.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title="Para quem quer evoluir de verdade no inglês." />
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {audiences.map(([Icon, title, text]) => (
                <article key={title} className="card-soft flex gap-4 p-5 sm:p-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-24 sm:py-32">
          <div className="absolute inset-0 surface-hero opacity-50" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Logo className="mx-auto size-12" />
            <h2 className="mt-7 text-3xl font-bold leading-tight sm:text-5xl">
              Descubra qual é o seu próximo passo.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-muted-foreground sm:text-lg">
              Comece sua jornada e descubra como o Evoluir+ pode orientar seu aprendizado de inglês.
            </p>
            <Button asChild size="lg" className="mt-8 min-h-12 w-full sm:w-auto">
              <Link to="/auth" search={{ mode: "signup" }}>
                COMEÇAR AGORA <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer lang="pt" />
    </div>
  );
}

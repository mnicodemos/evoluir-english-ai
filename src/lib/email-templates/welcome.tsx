import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import type { TemplateEntry } from "./registry";

const SITE = "https://evoluirmaisenglishai.com/dashboard";

interface WelcomeEmailProps {
  lang?: "pt" | "en";
  studentName?: string;
}

const COPY = {
  pt: {
    preview: "Sua jornada no inglês começa agora!",
    heading: "Boas-vindas ao Evoluir+ English AI!",
    greeting: (name: string) => `Olá, ${name}!`,
    intro:
      "Que bom ter você aqui. A partir de agora, EVO será sua parceira para desenvolver seu inglês com um plano adaptado ao seu nível, aos seus objetivos e ao seu ritmo.",
    howTitle: "Seu próximo passo",
    steps: [
      "Pratique conversação com EVO e receba feedback.",
      "Avance pelas aulas, vídeos, vocabulário e atividades.",
      "Acompanhe sua evolução e descubra o que praticar em seguida.",
    ],
    cta: "Acessar minha plataforma",
    help: "Sempre que precisar, entre na plataforma e continue de onde parou.",
    sign: "Bons estudos!\nEquipe Evoluir+ English AI",
  },
  en: {
    preview: "Your English learning journey starts now!",
    heading: "Welcome to Evoluir+ English AI!",
    greeting: (name: string) => `Hello, ${name}!`,
    intro:
      "We are glad you are here. EVO will help you build your English skills with a learning path adapted to your level, goals and pace.",
    howTitle: "Your next steps",
    steps: [
      "Practice speaking with EVO and get feedback.",
      "Explore lessons, videos, vocabulary and activities.",
      "Track your progress and discover what to practice next.",
    ],
    cta: "Open my learning platform",
    help: "Whenever you are ready, return to the platform and pick up where you left off.",
    sign: "Happy learning!\nThe Evoluir+ English AI team",
  },
} as const;

export function WelcomeEmail({ lang = "pt", studentName = "" }: WelcomeEmailProps) {
  const t = COPY[lang] ?? COPY.pt;
  const name = studentName.trim() || (lang === "pt" ? "estudante" : "student");

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ backgroundColor: "#f5f7f6", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            margin: "24px auto",
            maxWidth: 600,
            padding: 32,
          }}
        >
          <Heading style={{ color: "#111827", fontSize: 24, margin: "0 0 16px" }}>
            {t.heading}
          </Heading>
          <Text style={{ color: "#111827", fontSize: 16 }}>{t.greeting(name)}</Text>
          <Text style={{ color: "#4b5563", fontSize: 15, lineHeight: "24px" }}>{t.intro}</Text>
          <Heading as="h2" style={{ color: "#111827", fontSize: 18, margin: "24px 0 10px" }}>
            {t.howTitle}
          </Heading>
          {t.steps.map((step) => (
            <Text
              key={step}
              style={{ color: "#4b5563", fontSize: 14, lineHeight: "22px", margin: "0 0 8px" }}
            >
              • {step}
            </Text>
          ))}
          <Button
            href={SITE}
            style={{
              backgroundColor: "#00cdb3",
              borderRadius: 8,
              color: "#062b29",
              display: "inline-block",
              fontSize: 15,
              fontWeight: "bold",
              marginTop: 18,
              padding: "13px 22px",
              textDecoration: "none",
            }}
          >
            {t.cta}
          </Button>
          <Hr style={{ borderColor: "#e5e7eb", margin: "28px 0 18px" }} />
          <Text style={{ color: "#6b7280", fontSize: 13, lineHeight: "21px" }}>{t.help}</Text>
          <Text style={{ color: "#6b7280", fontSize: 13, lineHeight: "21px", whiteSpace: "pre-line" }}>
            {t.sign}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: WelcomeEmail,
  displayName: "Student welcome",
  subject: (data: Record<string, unknown>) =>
    data["lang"] === "en"
      ? "Welcome to Evoluir+ English AI!"
      : "Boas-vindas ao Evoluir+ English AI!",
  previewData: { lang: "pt", studentName: "Ana" },
} satisfies TemplateEntry;

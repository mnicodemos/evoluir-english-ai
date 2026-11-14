import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE = "https://evoluirmaisenglishai.com/premium";

interface PremiumBenefitsProps {
  lang?: "pt" | "en";
  studentName?: string;
}

const COPY = {
  pt: {
    preview: "Descubra tudo o que o Evoluir+ Premium pode oferecer.",
    heading: "Leve seu inglês mais longe com o Premium",
    greeting: (name: string) => `Olá, ${name}!`,
    intro: "Você já começou sua jornada no Evoluir+ English AI. Com o Premium, pode ampliar suas oportunidades de prática e desenvolvimento.",
    benefits: [
      "Até 5x mais uso diário dos recursos de IA: conversação, videochamadas e correções.",
      "Business English a partir do B1: 36 aulas para reuniões, e-mails e entrevistas.",
      "Life+ AI completo: rotina, hábitos, decisões e Life Coach.",
      "Todas as meditações em inglês.",
      "Music Lab: crie sua própria música em inglês, uma por dia.",
      "Vídeos extras das aulas, organizados por nível.",
    ],
    cta: "Conhecer o Premium",
    note: "O plano gratuito continua disponível. Faça upgrade somente quando fizer sentido para seus objetivos.",
    sign: "Conte com a EVO nessa jornada!\nEquipe Evoluir+ English AI",
  },
  en: {
    preview: "Discover what Evoluir+ Premium can offer.",
    heading: "Take your English further with Premium",
    greeting: (name: string) => `Hello, ${name}!`,
    intro: "You have started your Evoluir+ English AI journey. Premium gives you more ways to practice and grow.",
    benefits: [
      "Up to 5x the daily AI usage: speaking, video calls and corrections.",
      "Business English from B1: 36 lessons for meetings, emails and interviews.",
      "Full Life+ AI: routines, habits, decisions and Life Coach.",
      "Every meditation in English.",
      "Music Lab: create your own English song, one per day.",
      "Extra lesson videos by level.",
    ],
    cta: "Explore Premium",
    note: "The Free plan remains available. Upgrade whenever it makes sense for your goals.",
    sign: "EVO is here to support your journey!\nThe Evoluir+ English AI team",
  },
} as const;

export function PremiumBenefitsEmail({ lang = "pt", studentName = "" }: PremiumBenefitsProps) {
  const t = COPY[lang] ?? COPY.pt;
  const name = studentName.trim() || (lang === "pt" ? "estudante" : "student");
  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ backgroundColor: "#f5f7f6", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, margin: "24px auto", maxWidth: 600, padding: 32 }}>
          <Heading style={{ color: "#111827", fontSize: 24 }}>{t.heading}</Heading>
          <Text style={{ color: "#111827", fontSize: 16 }}>{t.greeting(name)}</Text>
          <Text style={{ color: "#4b5563", fontSize: 15, lineHeight: "24px" }}>{t.intro}</Text>
          {t.benefits.map((benefit) => (
            <Text key={benefit} style={{ color: "#4b5563", fontSize: 14, lineHeight: "22px", margin: "0 0 10px" }}>
              ✓ {benefit}
            </Text>
          ))}
          <Button href={SITE} style={{ backgroundColor: "#00cdb3", borderRadius: 8, color: "#062b29", display: "inline-block", fontSize: 15, fontWeight: "bold", marginTop: 18, padding: "13px 22px", textDecoration: "none" }}>
            {t.cta}
          </Button>
          <Hr style={{ borderColor: "#e5e7eb", margin: "28px 0 18px" }} />
          <Text style={{ color: "#6b7280", fontSize: 13, lineHeight: "21px" }}>{t.note}</Text>
          <Text style={{ color: "#6b7280", fontSize: 13, lineHeight: "21px", whiteSpace: "pre-line" }}>{t.sign}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: PremiumBenefitsEmail,
  displayName: "Premium benefits",
  subject: (data: Record<string, unknown>) =>
    data["lang"] === "en" ? "Discover Evoluir+ Premium" : "Conheça os benefícios do Evoluir+ Premium",
  previewData: { lang: "pt", studentName: "Ana" },
} satisfies TemplateEntry;

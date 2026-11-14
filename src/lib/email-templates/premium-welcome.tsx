import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface PremiumWelcomeProps { lang?: "pt" | "en"; studentName?: string }
const COPY = {
  pt: {
    preview: "Sua assinatura Premium está ativa. Aproveite todos os recursos!",
    heading: "Boas-vindas ao Evoluir+ Premium!",
    greeting: (name: string) => `Olá, ${name}!`,
    intro: "Sua assinatura Premium foi confirmada. Agora você tem mais recursos para acelerar sua evolução no inglês e aproveitar toda a experiência Evoluir+.",
    benefits: ["Mais uso diário dos recursos de IA para praticar e receber feedback.", "Business English com aulas para reuniões, e-mails e entrevistas.", "Life+ AI completo para organizar rotina, hábitos e decisões.", "Meditações em inglês, Music Lab e vídeos extras das aulas."],
    cta: "Acessar minha plataforma",
    sign: "Conte com a EVO nessa nova etapa!\nEquipe Evoluir+ English AI",
  },
  en: {
    preview: "Your Premium subscription is active. Enjoy all the features!",
    heading: "Welcome to Evoluir+ Premium!",
    greeting: (name: string) => `Hello, ${name}!`,
    intro: "Your Premium subscription is confirmed. You now have more resources to accelerate your English learning and enjoy the full Evoluir+ experience.",
    benefits: ["More daily AI usage to practice and receive feedback.", "Business English lessons for meetings, emails and interviews.", "Full Life+ AI for routines, habits and decisions.", "English meditations, Music Lab and extra lesson videos."],
    cta: "Open my learning platform",
    sign: "EVO is here for this next step!\nThe Evoluir+ English AI team",
  },
} as const;

export function PremiumWelcomeEmail({ lang = "pt", studentName = "" }: PremiumWelcomeProps) {
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
          {t.benefits.map((benefit) => <Text key={benefit} style={{ color: "#4b5563", fontSize: 14, lineHeight: "22px" }}>✓ {benefit}</Text>)}
          <Button href="https://evoluirmaisenglishai.com/dashboard" style={{ backgroundColor: "#00cdb3", borderRadius: 8, color: "#062b29", display: "inline-block", fontSize: 15, fontWeight: "bold", marginTop: 18, padding: "13px 22px", textDecoration: "none" }}>{t.cta}</Button>
          <Hr style={{ borderColor: "#e5e7eb", margin: "28px 0 18px" }} />
          <Text style={{ color: "#6b7280", fontSize: 13, whiteSpace: "pre-line" }}>{t.sign}</Text>
        </Container>
      </Body>
    </Html>
  );
}
export const template = {
  component: PremiumWelcomeEmail,
  displayName: "Premium subscriber welcome",
  subject: (data: Record<string, unknown>) => data["lang"] === "en" ? "Welcome to Evoluir+ Premium!" : "Boas-vindas ao Evoluir+ Premium!",
  previewData: { lang: "pt", studentName: "Ana" },
} satisfies TemplateEntry;

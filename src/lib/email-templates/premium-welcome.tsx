import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
interface Props {
  lang?: "pt" | "en";
  studentName?: string;
}
const copy = {
  pt: {
    preview: "Sua assinatura Premium está ativa!",
    title: "Boas-vindas ao Evoluir+ Premium!",
    hello: (n: string) => `Olá, ${n}!`,
    intro:
      "Sua assinatura foi confirmada. Agora você tem mais recursos para acelerar sua evolução no inglês.",
    benefits: [
      "Mais uso diário dos recursos de IA para praticar e receber feedback.",
      "Business English com aulas para reuniões, e-mails e entrevistas.",
      "Life+ AI completo, meditações em inglês, Music Lab e vídeos extras.",
    ],
    cta: "Acessar minha plataforma",
  },
  en: {
    preview: "Your Premium subscription is active!",
    title: "Welcome to Evoluir+ Premium!",
    hello: (n: string) => `Hello, ${n}!`,
    intro:
      "Your subscription is confirmed. You now have more resources to accelerate your English learning.",
    benefits: [
      "More daily AI usage to practice and receive feedback.",
      "Business English lessons for meetings, emails and interviews.",
      "Full Life+ AI, English meditations, Music Lab and extra lesson videos.",
    ],
    cta: "Open my learning platform",
  },
} as const;
export function PremiumWelcomeEmail({ lang = "pt", studentName = "" }: Props) {
  const t = copy[lang] ?? copy.pt;
  const name = studentName.trim() || (lang === "pt" ? "estudante" : "student");
  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ backgroundColor: "#f5f7f6", fontFamily: "Arial,sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            margin: "24px auto",
            maxWidth: 600,
            overflow: "hidden",
          }}
        >
          <Section style={{ backgroundColor: "#082f32", padding: "24px 32px", textAlign: "center" }}>
            <Img
              src="https://evoluirmaisenglishai.com/__l5e/assets-v1/3a38d664-c60e-4a50-9e5a-31f09b278a69/evoluir-logo-official.png"
              alt="Evoluir+ English AI"
              width="92"
              height="132"
              style={{ display: "block", width: "92px", height: "132px", objectFit: "contain", margin: "0 auto" }}
            />
          </Section>
          <Section style={{ padding: "28px 32px 32px" }}>
          <Heading style={{ color: "#111827", fontSize: 24 }}>{t.title}</Heading>
          <Text>{t.hello(name)}</Text>
          <Text style={{ color: "#4b5563", lineHeight: "24px" }}>{t.intro}</Text>
          {t.benefits.map((x) => (
            <Text key={x} style={{ color: "#4b5563", fontSize: 14 }}>
              ✓ {x}
            </Text>
          ))}
          <Button
            href="https://evoluirmaisenglishai.com/dashboard"
            style={{
              backgroundColor: "#00cdb3",
              borderRadius: 8,
              color: "#062b29",
              display: "inline-block",
              padding: "13px 22px",
              textDecoration: "none",
            }}
          >
            {t.cta}
          </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
export const template = {
  component: PremiumWelcomeEmail,
  displayName: "Premium subscriber welcome",
  subject: (d: Record<string, unknown>) =>
    d["lang"] === "en" ? "Welcome to Evoluir+ Premium!" : "Boas-vindas ao Evoluir+ Premium!",
  previewData: { lang: "pt", studentName: "Ana" },
} satisfies TemplateEntry;

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import symbolLight from "@/assets/evoluir-symbol-light.webp";
import type { TemplateEntry } from "./registry";

const SITE = "https://evoluirmaisenglishai.com/dashboard";
const CONTACT = "contato@evoluirmaisenglishai.com";

interface WelcomeEmailProps {
  lang?: "pt" | "en";
  studentName?: string;
}

const COPY = {
  pt: {
    preview: "Sua jornada de evolução no inglês começa agora.",
    heading: "Bem-vindo(a) ao Evoluir+",
    greeting: (name: string) => `Olá, ${name}!`,
    intro:
      "É um prazer ter você conosco. Aprender inglês é ampliar possibilidades, desenvolver confiança e abrir caminhos para novas oportunidades. O Evoluir+ foi criado para acompanhar essa jornada com inteligência, personalização e consistência.",
    sectionTitle: "Uma experiência que evolui com você",
    features: [
      [
        "Aprendizagem personalizada",
        "Conteúdos e atividades alinhados ao seu nível e ao seu ritmo.",
      ],
      [
        "AI Teacher",
        "Orientação inteligente para praticar, esclarecer dúvidas e ganhar confiança.",
      ],
      [
        "Prática integrada",
        "Desenvolva vocabulário, gramática, leitura, escrita, compreensão e conversação.",
      ],
      [
        "Evolução acompanhada",
        "Entenda seu progresso e descubra quais são os próximos passos.",
      ],
    ],
    nextTitle: "Seu próximo passo",
    next:
      "Acesse sua plataforma, conheça seu ambiente de aprendizagem e comece pela atividade recomendada para você.",
    cta: "Acessar minha plataforma",
    closing:
      "Você não precisa aprender tudo de uma vez. Um passo consistente de cada vez faz a diferença.",
    sign: "Conte com a gente nessa jornada.\nEquipe Evoluir+ English AI",
    help: "Precisa de ajuda? Fale conosco:",
    footer: "Your progress. Your possibilities.",
  },
  en: {
    preview: "Your English learning journey starts now!",
    heading: "Welcome to Evoluir+ English AI!",
    greeting: (name: string) => `Hello, ${name}!`,
    intro:
      "We are glad you are here. EVO will help you build your English skills with a learning path adapted to your level, goals and pace.",
    sectionTitle: "An experience that evolves with you",
    features: [
      ["Personalized learning", "Lessons and activities adapted to your level and pace."],
      [
        "AI Teacher",
        "Intelligent guidance to practise, ask questions and build confidence.",
      ],
      [
        "Integrated practice",
        "Develop vocabulary, grammar, reading, writing, listening and speaking.",
      ],
      [
        "Progress tracking",
        "Understand your progress and discover what to practise next.",
      ],
    ],
    nextTitle: "Your next step",
    next:
      "Open your platform, explore your learning space and start with your recommended activity.",
    cta: "Open my learning platform",
    closing:
      "You do not need to learn everything at once. One consistent step at a time makes a difference.",
    sign: "We are here to support your journey.\nThe Evoluir+ English AI team",
    help: "Need help? Contact us:",
    footer: "Your progress. Your possibilities.",
  },
} as const;

export function WelcomeEmail({ lang = "pt", studentName = "" }: WelcomeEmailProps) {
  const t = COPY[lang] ?? COPY.pt;
  const name = studentName.trim() || (lang === "pt" ? "estudante" : "student");

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f3f6f5",
          fontFamily: "Arial, Helvetica, sans-serif",
          margin: 0,
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            margin: "32px auto",
            maxWidth: 600,
            overflow: "hidden",
          }}
        >
          <Section
            style={{
              backgroundColor: "#082f32",
              padding: "28px 36px",
              textAlign: "center",
            }}
          >
            <Img
              src={symbolLight}
              alt="Evoluir+ English AI"
              width="42"
              height="42"
              style={{ display: "block", margin: "0 auto 10px" }}
            />
            <Text
              style={{
                color: "#ffffff",
                fontSize: 17,
                fontWeight: "bold",
                letterSpacing: "0.4px",
                margin: 0,
              }}
            >
              EVOLUIR+ <span style={{ color: "#48d8c4" }}>ENGLISH AI</span>
            </Text>
          </Section>
          <Section style={{ padding: "34px 36px 12px" }}>
            <Text
              style={{
                color: "#079e91",
                fontSize: 11,
                fontWeight: "bold",
                letterSpacing: "1.8px",
                margin: "0 0 12px",
                textTransform: "uppercase",
              }}
            >
              MORE THAN ENGLISH
            </Text>
            <Heading
              style={{
                color: "#102d30",
                fontSize: 29,
                fontWeight: "bold",
                lineHeight: "36px",
                margin: "0 0 18px",
              }}
            >
              {t.heading}
            </Heading>
            <Text style={{ color: "#24383a", fontSize: 16, lineHeight: "25px" }}>
              {t.greeting(name)}
            </Text>
            <Text style={{ color: "#536568", fontSize: 15, lineHeight: "25px" }}>
              {t.intro}
            </Text>
          </Section>
          <Section style={{ padding: "8px 36px 4px" }}>
            <Heading
              as="h2"
              style={{ color: "#102d30", fontSize: 19, margin: "12px 0 18px" }}
            >
              {t.sectionTitle}
            </Heading>
            {t.features.map(([title, description]) => (
              <Section
                key={title}
                style={{
                  borderLeft: "3px solid #35cbb8",
                  margin: "0 0 14px",
                  padding: "1px 0 1px 15px",
                }}
              >
                <Text
                  style={{
                    color: "#173638",
                    fontSize: 14,
                    fontWeight: "bold",
                    margin: "0 0 4px",
                  }}
                >
                  {title}
                </Text>
                <Text style={{ color: "#647477", fontSize: 14, lineHeight: "22px", margin: 0 }}>
                  {description}
                </Text>
              </Section>
            ))}
          </Section>
          <Section
            style={{
              backgroundColor: "#f0faf8",
              borderRadius: 12,
              margin: "20px 36px 8px",
              padding: "20px 22px",
            }}
          >
            <Heading
              as="h2"
              style={{ color: "#102d30", fontSize: 18, margin: "0 0 8px" }}
            >
              {t.nextTitle}
            </Heading>
            <Text style={{ color: "#536568", fontSize: 14, lineHeight: "23px", margin: 0 }}>
              {t.next}
            </Text>
          </Section>
          <Section style={{ padding: "18px 36px 8px", textAlign: "center" }}>
            <Button
              href={SITE}
              style={{
                backgroundColor: "#00bda9",
                borderRadius: 8,
                color: "#062b29",
                display: "inline-block",
                fontSize: 15,
                fontWeight: "bold",
                padding: "14px 25px",
                textDecoration: "none",
              }}
            >
              {t.cta}
            </Button>
          </Section>
          <Section style={{ padding: "14px 36px 26px" }}>
            <Text style={{ color: "#536568", fontSize: 14, lineHeight: "23px" }}>
              {t.closing}
            </Text>
            <Text
              style={{
                color: "#24383a",
                fontSize: 14,
                lineHeight: "23px",
                whiteSpace: "pre-line",
              }}
            >
              {t.sign}
            </Text>
          </Section>
          <Hr style={{ borderColor: "#e4ecea", margin: 0 }} />
          <Section
            style={{
              backgroundColor: "#f8faf9",
              padding: "20px 36px 24px",
              textAlign: "center",
            }}
          >
            <Text style={{ color: "#647477", fontSize: 12, lineHeight: "19px", margin: "0 0 5px" }}>
              {t.help}
            </Text>
            <Text style={{ fontSize: 13, margin: "0 0 12px" }}>
              <a
                href={`mailto:${CONTACT}`}
                style={{ color: "#078f84", textDecoration: "none" }}
              >
                {CONTACT}
              </a>
            </Text>
            <Text
              style={{
                color: "#879493",
                fontSize: 11,
                letterSpacing: "0.5px",
                margin: "0 0 7px",
              }}
            >
              {t.footer}
            </Text>
            <Text style={{ color: "#a0abaa", fontSize: 10, margin: 0 }}>
              © Evoluir+ English AI. Todos os direitos reservados.
            </Text>
          </Section>
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
      : "Bem-vindo(a) ao Evoluir+ | Sua jornada em inglês começa agora",
  previewData: { lang: "pt", studentName: "Ana" },
} satisfies TemplateEntry;

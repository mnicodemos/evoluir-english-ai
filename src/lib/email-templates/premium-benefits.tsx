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

import type { TemplateEntry } from "./registry";

const SITE = "https://evoluirmaisenglishai.com/premium";
const CONTACT = "contato@evoluirmaisenglishai.com";

interface PremiumBenefitsProps {
  studentName?: string;
}

const BENEFITS = [
  {
    title: "Mais possibilidades com IA",
    description:
      "Amplie seu uso diário dos recursos de inteligência artificial, incluindo conversação, videochamadas e correções.",
  },
  {
    title: "Business English",
    description:
      "Acesse 36 aulas a partir do nível B1, com conteúdos para reuniões, e-mails e entrevistas.",
  },
  {
    title: "Life+ AI completo",
    description:
      "Organize sua rotina, desenvolva hábitos, tome decisões com mais clareza e conte com o Life Coach.",
  },
  {
    title: "Meditações em inglês",
    description:
      "Tenha acesso a todas as meditações para incluir o inglês também nos seus momentos de pausa.",
  },
  {
    title: "Music Lab",
    description: "Crie sua própria música em inglês, com a possibilidade de gerar uma por dia.",
  },
  {
    title: "Vídeos extras das aulas",
    description:
      "Explore vídeos complementares organizados por nível para aprofundar sua aprendizagem.",
  },
] as const;

export function PremiumBenefitsEmail({ studentName = "" }: PremiumBenefitsProps) {
  const name = studentName.trim() || "estudante";

  return (
    <Html>
      <Head />
      <Preview>Descubra novas possibilidades para evoluir com o Evoluir+ Premium.</Preview>
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
              src="https://raw.githubusercontent.com/mnicodemos/evoluir-english-ai/main/src/assets/evoluir-symbol-light.webp"
              alt="Símbolo Evoluir+ English AI"
              width="28"
              height="56"
              style={{
                display: "block",
                width: "28px",
                height: "56px",
                objectFit: "contain",
                backgroundColor: "transparent",
                margin: "0 auto 10px",
              }}
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
              SUA PRÓXIMA EVOLUÇÃO
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
              Leve seu inglês mais longe com o Premium
            </Heading>
            <Text style={{ color: "#24383a", fontSize: 16, lineHeight: "25px" }}>Olá, {name}!</Text>
            <Text style={{ color: "#536568", fontSize: 15, lineHeight: "25px" }}>
              Você já começou sua jornada no Evoluir+ English AI. O Premium amplia suas
              possibilidades de prática e desenvolvimento, reunindo mais recursos para acompanhar
              seus objetivos e seu ritmo.
            </Text>
          </Section>
          <Section style={{ padding: "8px 36px 4px" }}>
            <Heading as="h2" style={{ color: "#102d30", fontSize: 19, margin: "12px 0 18px" }}>
              Descubra o que você pode desbloquear
            </Heading>
            {BENEFITS.map((benefit) => (
              <Section
                key={benefit.title}
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
                  {benefit.title}
                </Text>
                <Text style={{ color: "#647477", fontSize: 14, lineHeight: "22px", margin: 0 }}>
                  {benefit.description}
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
            <Heading as="h2" style={{ color: "#102d30", fontSize: 18, margin: "0 0 8px" }}>
              No seu tempo, de acordo com seus objetivos
            </Heading>
            <Text style={{ color: "#536568", fontSize: 14, lineHeight: "23px", margin: 0 }}>
              O plano gratuito continua disponível. Você pode conhecer o Premium e fazer o upgrade
              quando os recursos adicionais fizerem sentido para sua jornada.
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
              Conhecer o Premium
            </Button>
          </Section>
          <Section style={{ padding: "14px 36px 26px" }}>
            <Text style={{ color: "#536568", fontSize: 14, lineHeight: "23px" }}>
              Conte com a EVO para continuar evoluindo, um passo de cada vez.
            </Text>
            <Text
              style={{
                color: "#24383a",
                fontSize: 14,
                lineHeight: "23px",
                whiteSpace: "pre-line",
              }}
            >
              Equipe Evoluir+ English AI
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
              Precisa de ajuda? Fale conosco:
            </Text>
            <Text style={{ fontSize: 13, margin: "0 0 12px" }}>
              <a href={`mailto:${CONTACT}`} style={{ color: "#078f84", textDecoration: "none" }}>
                {CONTACT}
              </a>
            </Text>
            <Text style={{ color: "#879493", fontSize: 11, letterSpacing: "0.5px", margin: 0 }}>
              Sua evolução. Suas possibilidades.
            </Text>
            <Text style={{ color: "#a0abaa", fontSize: 10, margin: "7px 0 0" }}>
              © Evoluir+ English AI. Todos os direitos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: PremiumBenefitsEmail,
  displayName: "Premium benefits",
  subject: "Conheça os benefícios do Evoluir+ Premium",
  previewData: { studentName: "Ana" },
} satisfies TemplateEntry;

import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface ReactivationProps {
  studentName?: string;
  milestoneDays?: number;
  unsubscribeUrl?: string;
}

export function ReactivationEmail({
  studentName = "",
  milestoneDays = 2,
  unsubscribeUrl = "https://evoluirmaisenglishai.com",
}: ReactivationProps) {
  const name = studentName.trim() || "estudante";
  const messages: Record<number, { subject: string; heading: string; body: string }> = {
    2: { subject: "Que tal retomar seu inglês hoje?", heading: "Sentimos sua falta!", body: "Dois dias longe da prática já são um bom motivo para dar um novo passo. Sua jornada continua no seu ritmo — retome com uma atividade rápida." },
    4: { subject: "Seu inglês continua evoluindo, um passo de cada vez", heading: "Vamos continuar de onde você parou?", body: "Uma pequena sessão de estudo pode ajudar a recuperar o ritmo. Acesse sua plataforma e escolha a próxima atividade." },
    7: { subject: "Uma semana para voltar a praticar inglês", heading: "Que tal reservar alguns minutos para você?", body: "Consistência não significa estudar perfeitamente todos os dias. Significa recomeçar. EVO está pronta para acompanhar seu próximo passo." },
    14: { subject: "Seu próximo passo no inglês espera por você", heading: "Duas semanas passaram. Podemos recomeçar?", body: "Seu espaço de aprendizagem continua disponível. Retome suas atividades e avance de acordo com seus objetivos." },
    30: { subject: "Estamos aqui quando quiser retomar seu inglês", heading: "Sua jornada pode continuar", body: "Faz um mês desde sua última atividade. Se ainda fizer sentido para você, volte ao Evoluir+ e retome seus estudos no seu próprio ritmo." },
  };
  const message = messages[milestoneDays] ?? messages[2]!;
  return (
    <Html>
      <Head />
      <Preview>{message.subject}</Preview>
      <Body style={{ backgroundColor: "#f3f6f5", fontFamily: "Arial, Helvetica, sans-serif", margin: 0 }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 16, margin: "32px auto", maxWidth: 600, overflow: "hidden" }}>
          <Section style={{ backgroundColor: "#082f32", padding: "24px 36px", textAlign: "center" }}>
            <Img src="https://evoluirmaisenglishai.com/__l5e/assets-v1/3a38d664-c60e-4a50-9e5a-31f09b278a69/evoluir-logo-official.png" alt="Evoluir+ English AI" width="92" height="132" style={{ display: "block", width: "92px", height: "132px", objectFit: "contain", margin: "0 auto" }} />
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "bold", margin: 0 }}>EVOLUIR+ ENGLISH AI</Text>
          </Section>
          <Section style={{ padding: "34px 36px 12px" }}>
            <Text style={{ color: "#079e91", fontSize: 11, fontWeight: "bold", letterSpacing: "1.8px" }}>SUA JORNADA CONTINUA</Text>
            <Heading style={{ color: "#102d30", fontSize: 28, lineHeight: "36px" }}>{message.heading}</Heading>
            <Text style={{ color: "#24383a", fontSize: 16, lineHeight: "25px" }}>Olá, {name}!</Text>
            <Text style={{ color: "#536568", fontSize: 15, lineHeight: "25px" }}>{message.body}</Text>
          </Section>
          <Section style={{ padding: "18px 36px 28px", textAlign: "center" }}>
            <Button href="https://evoluirmaisenglishai.com/dashboard" style={{ backgroundColor: "#00bda9", borderRadius: 8, color: "#062b29", display: "inline-block", fontSize: 15, fontWeight: "bold", padding: "14px 25px", textDecoration: "none" }}>Retomar meus estudos</Button>
          </Section>
          <Hr style={{ borderColor: "#e4ecea", margin: 0 }} />
          <Section style={{ backgroundColor: "#f8faf9", padding: "18px 36px 22px", textAlign: "center" }}>
            <Text style={{ color: "#647477", fontSize: 12, lineHeight: "19px" }}>Você recebe esta mensagem porque ativou os e-mails de reativação do Evoluir+.</Text>
            <Text style={{ fontSize: 12 }}><a href={unsubscribeUrl} style={{ color: "#078f84" }}>Cancelar recebimento destes e-mails</a></Text>
            <Text style={{ color: "#a0abaa", fontSize: 10 }}>© Evoluir+ English AI</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ReactivationEmail,
  displayName: "Student reactivation",
  subject: (data: Record<string, unknown>) => {
    const days = Number(data.milestoneDays ?? 2);
    const subjects: Record<number, string> = {
      2: "Que tal retomar seu inglês hoje?",
      4: "Seu inglês continua evoluindo, um passo de cada vez",
      7: "Uma semana para voltar a praticar inglês",
      14: "Seu próximo passo no inglês espera por você",
      30: "Estamos aqui quando quiser retomar seu inglês",
    };
    return subjects[days] ?? subjects[2]!;
  },
  previewData: { studentName: "Ana", milestoneDays: 2, unsubscribeUrl: "https://evoluirmaisenglishai.com" },
} satisfies TemplateEntry;

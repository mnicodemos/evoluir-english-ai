import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import type { TemplateEntry } from './registry'

const SITE = 'https://evoluirmaisenglishai.lovable.app'

interface CourseGuideEmailProps {
  lang?: 'pt' | 'en'
}

const COPY = {
  pt: {
    preview: 'Seu guia do curso Evoluir+ English AI',
    heading: 'Seu guia do Evoluir+ English AI',
    intro:
      'Obrigado pelo interesse! Aqui está um resumo do curso de inglês com professor particular de IA, feito para profissionais brasileiros que precisam falar inglês de verdade.',
    methodTitle: 'A metodologia (5 camadas)',
    method: [
      'Vídeo curto (até 7 min) com legendas, sempre no tema da aula.',
      'Resumo, objetivo e vocabulário-chave da aula.',
      'Flashcards com repetição espaçada, pronúncia e exemplos reais.',
      'Produção: conversa por voz com a IA, correção de textos e laboratório de escuta.',
      'Avaliação: quiz por aula (70% para passar) e Teste Final de 30 questões para subir de nível.',
    ],
    planTitle: 'Investimento',
    plan: [
      'Plano gratuito: comece hoje, sem cartão de crédito.',
      'Premium: R$ 79,90/mês ou R$ 799,90/ano (2 meses grátis).',
    ],
    ctaText: 'Crie sua conta gratuita e faça sua primeira aula hoje:',
    cta: 'Começar agora',
    sign: 'Equipe Evoluir+',
  },
  en: {
    preview: 'Your Evoluir+ English AI course guide',
    heading: 'Your Evoluir+ English AI guide',
    intro:
      'Thanks for your interest! Here is an overview of the English course with a personal AI teacher, built for professionals who need to actually speak English.',
    methodTitle: 'The method (5 layers)',
    method: [
      'A short video (up to 7 min) with captions, always on the lesson topic.',
      'Summary, objective and key vocabulary for the lesson.',
      'Flashcards with spaced repetition, pronunciation and real examples.',
      'Production: voice conversation with the AI, writing correction and listening lab.',
      'Assessment: a quiz per lesson (70% to pass) and a 30-question Final Test to level up.',
    ],
    planTitle: 'Investment',
    plan: [
      'Free plan: start today, no credit card.',
      'Premium: R$ 79.90/month or R$ 799.90/year (2 months free).',
    ],
    ctaText: 'Create your free account and take your first lesson today:',
    cta: 'Start now',
    sign: 'The Evoluir+ team',
  },
} as const

export function CourseGuideEmail({ lang = 'pt' }: CourseGuideEmailProps) {
  const t = COPY[lang] ?? COPY.pt

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ backgroundColor: '#f5f7f6', fontFamily: 'Arial, sans-serif', margin: 0 }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, margin: '24px auto', maxWidth: 600, padding: 32 }}>
          <Heading style={{ color: '#111827', fontSize: 22, margin: '0 0 12px' }}>{t.heading}</Heading>
          <Text style={{ color: '#4b5563', fontSize: 15, lineHeight: '24px' }}>{t.intro}</Text>

          <Section>
            <Heading as="h2" style={{ color: '#111827', fontSize: 17, margin: '24px 0 8px' }}>
              {t.methodTitle}
            </Heading>
            {t.method.map((item) => (
              <Text key={item} style={{ color: '#4b5563', fontSize: 14, lineHeight: '22px', margin: '0 0 6px' }}>
                • {item}
              </Text>
            ))}
          </Section>

          <Section>
            <Heading as="h2" style={{ color: '#111827', fontSize: 17, margin: '24px 0 8px' }}>
              {t.planTitle}
            </Heading>
            {t.plan.map((item) => (
              <Text key={item} style={{ color: '#4b5563', fontSize: 14, lineHeight: '22px', margin: '0 0 6px' }}>
                • {item}
              </Text>
            ))}
          </Section>

          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />

          <Text style={{ color: '#4b5563', fontSize: 15, lineHeight: '24px' }}>{t.ctaText}</Text>
          <Link
            href={SITE}
            style={{
              backgroundColor: '#111827',
              borderRadius: 8,
              color: '#ffffff',
              display: 'inline-block',
              fontSize: 15,
              fontWeight: 'bold',
              padding: '12px 22px',
              textDecoration: 'none',
            }}
          >
            {t.cta}
          </Link>

          <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 28 }}>{t.sign}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CourseGuideEmail,
  displayName: 'Course guide',
  subject: (data: Record<string, any>) =>
    data['lang'] === 'en'
      ? 'Your Evoluir+ English AI course guide'
      : 'Seu guia do curso Evoluir+ English AI',
  previewData: { lang: 'pt' },
} satisfies TemplateEntry

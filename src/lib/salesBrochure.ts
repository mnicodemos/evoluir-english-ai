import { jsPDF } from "jspdf";

import type { LandingLang } from "@/lib/landingCopy";
import { savePdf } from "@/lib/pdfDownload";
import { ACCENT, DARK, INK, MUTED, drawCover, drawFooters, drawHeader, loadLogo } from "@/lib/pdfTheme";

type Section = { title: string; intro?: string; bullets?: string[] };

type Brochure = {
  title: string;
  subtitle: string;
  meta: string;
  hero: string;
  heroText: string;
  sections: Section[];
  offerTitle: string;
  offerLines: string[];
  guarantee: string;
  ctaTitle: string;
  ctaText: string;
  ctaUrl: string;
  footerLabel: string;
  filename: string;
};

const SITE = "https://evoluirmaisenglishai.lovable.app";

const COPY: Record<LandingLang, Brochure> = {
  pt: {
    title: "Evoluir+ English AI",
    subtitle: "O curso de inglês com professor particular de IA",
    meta: "Guia do curso e da metodologia",
    hero: "Você não precisa de mais um app. Precisa de um professor.",
    heroText:
      "A maioria dos profissionais brasileiros estuda inglês há anos e ainda trava numa reunião. O problema não é falta de esforço: é falta de prática real, feedback imediato e um caminho claro. O Evoluir+ English AI resolve exatamente isso — em 10 a 20 minutos por dia.",
    sections: [
      {
        title: "Para quem é este curso",
        bullets: [
          "Profissionais que precisam falar inglês no trabalho e não têm tempo para aula tradicional.",
          "Quem entende bastante, mas trava na hora de falar.",
          "Quem já tentou apps de repetição e parou por falta de evolução visível.",
          "Quem quer viajar, estudar fora ou abrir portas de carreira com o inglês.",
        ],
      },
      {
        title: "A metodologia Evoluir+ (as 5 camadas)",
        intro:
          "Cada nível do MCER (A1 a C2) tem 30 aulas divididas em 5 unidades. Nada de conteúdo solto: você segue uma trilha construída na sequência certa.",
        bullets: [
          "1. Input com propósito — vídeo curto (até 7 min) com legendas, sempre no tema da aula.",
          "2. Compreensão ativa — resumo, objetivo e vocabulário-chave da aula em inglês.",
          "3. Fixação com repetição espaçada — flashcards com pronúncia, tradução e exemplo real.",
          "4. Produção — conversação por voz com a IA, correção de textos e laboratório de escuta.",
          "5. Avaliação — quiz de gramática a cada aula (aprovação a partir de 70%) e Teste Final de 30 questões para subir de nível.",
        ],
      },
      {
        title: "O que você pratica todos os dias",
        bullets: [
          "AI Talking: conversa por voz com feedback no seu nível, sem medo de errar.",
          "Writing AI Corrector: texto corrigido, versão natural de nativo e explicação do erro.",
          "Listening Lab: escuta guiada com reprodução palavra a palavra.",
          "Vocabulary: 10 palavras novas por dia, com teste de pronúncia pelo microfone.",
          "Progresso: notas de Listening, Reading, Talking e Writing que sobem a cada atividade.",
        ],
      },
      {
        title: "Por que funciona (e a aula tradicional não resolveu)",
        bullets: [
          "Prática ilimitada: o professor de IA está disponível às 6h ou às 23h.",
          "Feedback em segundos — você corrige o erro enquanto ele ainda está fresco.",
          "Personalização real: a IA conhece seu nível, suas palavras difíceis e seus erros frequentes.",
          "Constância: meta diária, sequência de estudo e ligas (Bronze até Diamante) que mantêm o hábito.",
          "Progressão honesta: só sobe de nível quem acerta 70% do Teste Final.",
        ],
      },
      {
        title: "Resultados que você percebe",
        bullets: [
          "Semana 1: rotina montada e primeira conversa completa em inglês.",
          "Mês 1: vocabulário ativo maior e textos profissionais corrigidos sem travar.",
          "Mês 3: reuniões, e-mails e apresentações com muito mais segurança.",
        ],
      },
    ],
    offerTitle: "Investimento",
    offerLines: [
      "Plano Gratuito — comece hoje, sem cartão de crédito: AI Talking, correção de textos, vocabulário e acompanhamento de progresso.",
      "Premium — R$ 79,90/mês ou R$ 799,90/ano (2 meses grátis).",
      "Premium inclui: sessões ilimitadas de AI Talking, correções ilimitadas, relatórios avançados de evolução e acesso prioritário a pronúncia e áudio.",
      "Compare: uma única aula particular de inglês costuma custar mais do que um mês inteiro de Premium — com prática todos os dias.",
    ],
    guarantee: "Sem fidelidade e sem cartão para começar. Você testa, evolui e decide depois.",
    ctaTitle: "Comece sua evolução hoje",
    ctaText:
      "Crie sua conta gratuita, faça o diagnóstico de nível em 2 minutos e tenha sua primeira aula ainda hoje. 10 minutos por dia já mudam o seu inglês.",
    ctaUrl: SITE,
    footerLabel: "Evoluir+ English AI · Guia do curso",
    filename: "evoluir-mais-english-ai-curso.pdf",
  },
  en: {
    title: "Evoluir+ English AI",
    subtitle: "The English course with a personal AI teacher",
    meta: "Course & methodology guide",
    hero: "You don't need another app. You need a teacher.",
    heroText:
      "Most professionals have studied English for years and still freeze in a meeting. The issue isn't effort — it's the lack of real practice, instant feedback and a clear path. Evoluir+ English AI fixes exactly that, in 10 to 20 minutes a day.",
    sections: [
      {
        title: "Who this course is for",
        bullets: [
          "Professionals who need English at work and have no time for traditional classes.",
          "People who understand a lot but freeze when it is time to speak.",
          "Anyone who tried repetition apps and quit for lack of visible progress.",
          "Anyone who wants to travel, study abroad or open career doors with English.",
        ],
      },
      {
        title: "The Evoluir+ method (5 layers)",
        intro:
          "Every CEFR level (A1 to C2) has 30 core lessons across 5 units, plus an optional 3-lesson review unit. No random content: you follow a path built in the right order.",
        bullets: [
          "1. Input with purpose — a short video (up to 7 min) with captions, always on the lesson topic.",
          "2. Active comprehension — summary, objective and key vocabulary in English.",
          "3. Spaced repetition — flashcards with pronunciation, translation and a real example.",
          "4. Production — voice conversation with the AI, writing correction and listening lab.",
          "5. Assessment — a grammar quiz per lesson (70% to pass) and a 30-question Final Test to level up.",
        ],
      },
      {
        title: "What you practise every day",
        bullets: [
          "AI Talking: voice conversation with feedback at your level, with no fear of mistakes.",
          "Writing AI Corrector: corrected text, the natural native version and clear explanations.",
          "Listening Lab: guided listening with word-by-word playback.",
          "Vocabulary: 10 new words a day with a microphone pronunciation check.",
          "Progress: Listening, Reading, Talking and Writing scores that rise with every session.",
        ],
      },
      {
        title: "Why it works",
        bullets: [
          "Unlimited practice: your AI teacher is there at 6am or 11pm.",
          "Feedback in seconds — you fix the mistake while it is still fresh.",
          "Real personalisation: the AI knows your level, your hard words and your frequent errors.",
          "Consistency: daily goal, study streak and leagues (Bronze to Diamond) that build the habit.",
          "Honest progression: you only level up by scoring 70% on the Final Test.",
        ],
      },
      {
        title: "Results you can feel",
        bullets: [
          "Week 1: routine in place and your first full conversation in English.",
          "Month 1: bigger active vocabulary and professional texts corrected without freezing.",
          "Month 3: meetings, emails and presentations with far more confidence.",
        ],
      },
    ],
    offerTitle: "Investment",
    offerLines: [
      "Free plan — start today, no credit card: AI Talking, writing correction, vocabulary and progress tracking.",
      "Premium — R$ 79.90/month or R$ 799.90/year (2 months free).",
      "Premium includes: unlimited AI Talking sessions, unlimited corrections, advanced progress reports and priority access to pronunciation & audio.",
      "Compare: a single private English lesson usually costs more than a whole month of Premium — with practice every single day.",
    ],
    guarantee: "No lock-in and no card to start. Try it, grow, and decide later.",
    ctaTitle: "Start your evolution today",
    ctaText:
      "Create your free account, take the 2-minute level check and have your first lesson today. Ten minutes a day already changes your English.",
    ctaUrl: SITE,
    footerLabel: "Evoluir+ English AI · Course guide",
    filename: "evoluir-mais-english-ai-course.pdf",
  },
};

/** Builds and downloads the sales brochure about the course and its methodology. */
export async function downloadSalesBrochure(lang: LandingLang = "pt"): Promise<boolean> {
  const c = COPY[lang];
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;

  const logo = await loadLogo();
  drawCover(doc, logo, {
    title: c.title,
    subtitle: c.subtitle,
    meta: c.meta,
    footnote: c.ctaUrl,
  });
  doc.addPage();
  drawHeader(doc, logo, { title: c.title, subtitle: c.subtitle, meta: c.meta, margin });

  let y = 150;

  function ensure(space: number) {
    if (y + space <= pageH - 56) return;
    doc.addPage();
    y = margin + 8;
  }

  function paragraph(text: string, size = 10.5, color = MUTED) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color.r, color.g, color.b);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    for (const line of lines) {
      ensure(size + 5);
      doc.text(line, margin, y);
      y += size + 5;
    }
  }

  function heading(text: string) {
    ensure(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.5);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(text, margin, y);
    y += 8;
    doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 46, y);
    y += 16;
  }

  function bullet(text: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(text, maxW - 18) as string[];
    ensure(lines.length * 15 + 4);
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.circle(margin + 3.5, y - 3.5, 2.4, "F");
    doc.setTextColor(INK.r, INK.g, INK.b);
    for (const line of lines) {
      doc.text(line, margin + 18, y);
      y += 15;
    }
    y += 4;
  }

  // Hero block
  ensure(90);
  doc.setFillColor(245, 247, 246);
  const heroLines = doc.splitTextToSize(c.hero, maxW - 32) as string[];
  const bodyLines = doc.splitTextToSize(c.heroText, maxW - 32) as string[];
  const heroH = 26 + heroLines.length * 20 + bodyLines.length * 14 + 12;
  doc.roundedRect(margin, y - 14, maxW, heroH, 10, 10, "F");
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(margin, y - 14, 4, heroH, "F");
  let hy = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK.r, INK.g, INK.b);
  for (const line of heroLines) {
    doc.text(line, margin + 18, hy);
    hy += 20;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  hy += 2;
  for (const line of bodyLines) {
    doc.text(line, margin + 18, hy);
    hy += 14;
  }
  y = y - 14 + heroH + 26;

  for (const section of c.sections) {
    heading(section.title);
    if (section.intro) {
      paragraph(section.intro);
      y += 6;
    }
    for (const b of section.bullets ?? []) bullet(b);
    y += 8;
  }

  heading(c.offerTitle);
  for (const line of c.offerLines) bullet(line);
  ensure(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
  const gLines = doc.splitTextToSize(c.guarantee, maxW) as string[];
  for (const line of gLines) {
    ensure(16);
    doc.text(line, margin, y);
    y += 15;
  }
  y += 18;

  // CTA block
  const ctaBody = doc.splitTextToSize(c.ctaText, maxW - 36) as string[];
  const ctaH = 34 + ctaBody.length * 14 + 30;
  ensure(ctaH + 10);
  doc.setFillColor(DARK.r, DARK.g, DARK.b);
  doc.roundedRect(margin, y, maxW, ctaH, 10, 10, "F");
  let cy = y + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(c.ctaTitle, margin + 18, cy);
  cy += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(205, 210, 218);
  for (const line of ctaBody) {
    doc.text(line, margin + 18, cy);
    cy += 14;
  }
  cy += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.textWithLink(c.ctaUrl, margin + 18, cy, { url: c.ctaUrl });
  y += ctaH + 20;

  drawFooters(doc, c.footerLabel, margin);

  return savePdf(doc, c.filename);
}

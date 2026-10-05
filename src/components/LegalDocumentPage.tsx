import { ArrowLeft } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useUiLang, type UiLang } from "@/lib/uiLang";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  lettered?: string[];
};

type LegalDocument = {
  title: string;
  updated: string;
  back: string;
  translationNote?: string;
  sections: LegalSection[];
};

const terms: Record<UiLang, LegalDocument> = {
  pt: {
    title: "Termos de Uso",
    updated: "Última atualização: 5 de outubro de 2026",
    back: "Voltar",
    sections: [
      {
        title: "1. Quem somos",
        paragraphs: [
          "O Evoluir+ English AI (evoluirmaisenglishai.com) é um serviço de aprendizado de inglês com apoio de inteligência artificial, oferecido por Marcelo Neves Nicodemos. Contato: evoluirmaisoficial@hotmail.com.",
        ],
      },
      {
        title: "2. Aceite",
        paragraphs: [
          "Ao criar uma conta ou usar o serviço, você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não utilize o serviço.",
        ],
      },
      {
        title: "3. Conta",
        paragraphs: [
          "Você deve fornecer informações verdadeiras, manter sua senha em sigilo e nos avisar se suspeitar de uso indevido. Você é responsável pelas atividades realizadas na sua conta.",
        ],
      },
      {
        title: "4. Menores de idade",
        paragraphs: [
          "Menores de 18 anos podem usar o serviço com o conhecimento e a autorização do pai, da mãe ou do responsável legal, que responde pelo uso e pela contratação de planos pagos. Menores de 12 anos só podem usar o serviço com o consentimento específico de um dos pais ou do responsável legal, conforme a Lei Geral de Proteção de Dados (LGPD).",
        ],
      },
      {
        title: "5. O serviço",
        paragraphs: [
          "Oferecemos aulas, vocabulário, prática de leitura, escrita, escuta e fala, e conversas com assistentes de inteligência artificial (EVO). Conteúdos e recursos podem ser alterados, ampliados ou removidos.",
        ],
      },
      {
        title: "6. Inteligência artificial",
        paragraphs: [
          "Respostas, correções e avaliações são geradas automaticamente e podem conter erros. Elas não substituem um professor, uma certificação nem uma avaliação oficial de proficiência. Os níveis do Quadro Europeu (CEFR) exibidos são estimativas.",
        ],
      },
      {
        title: "7. Planos e pagamentos",
        paragraphs: [
          'Há um plano gratuito e o plano Premium, mensal ou anual, com preços informados na página de assinatura. Os pagamentos são processados pela Stripe, e não armazenamos os dados do seu cartão. A assinatura é renovada automaticamente até ser cancelada. Você pode cancelar a qualquer momento em "Minha assinatura", mantendo o acesso até o fim do período já pago.',
        ],
      },
      {
        title: "8. Direito de arrependimento",
        paragraphs: [
          "Conforme o art. 49 do Código de Defesa do Consumidor, você pode desistir da contratação em até 7 dias, com reembolso integral, pelo e-mail de contato.",
        ],
      },
      {
        title: "9. Uso permitido",
        paragraphs: [
          "Não é permitido: usar o serviço para fins ilegais; tentar acessar contas ou dados de terceiros; burlar limites, pagamentos ou medidas de segurança; enviar conteúdo ofensivo, discriminatório ou que viole direitos de terceiros; ou usar automação para extrair conteúdo.",
        ],
      },
      {
        title: "10. Seu conteúdo",
        paragraphs: [
          "Os textos, gravações de voz e respostas que você envia continuam sendo seus. Você nos autoriza a processá-los somente para prestar o serviço (correções, avaliações e acompanhamento do progresso), conforme a Política de Privacidade.",
        ],
      },
      {
        title: "11. Propriedade intelectual",
        paragraphs: [
          "A marca Evoluir+, a personagem EVO, as aulas, os materiais e o software pertencem a nós ou são licenciados. O uso é pessoal e não comercial.",
        ],
      },
      {
        title: "12. Disponibilidade",
        paragraphs: [
          "Buscamos manter o serviço disponível, mas podem ocorrer interrupções para manutenção ou por falhas de fornecedores (hospedagem, inteligência artificial ou pagamentos).",
        ],
      },
      {
        title: "13. Encerramento",
        paragraphs: [
          "Você pode encerrar sua conta a qualquer momento pelo e-mail de contato. Podemos suspender contas que violem estes Termos, com aviso prévio sempre que possível.",
        ],
      },
      {
        title: "14. Responsabilidade",
        paragraphs: [
          "Na medida permitida pela lei, não respondemos por danos indiretos decorrentes do uso do serviço. Nada nestes Termos limita os direitos garantidos pelo Código de Defesa do Consumidor.",
        ],
      },
      {
        title: "15. Alterações",
        paragraphs: [
          "Podemos atualizar estes Termos. Mudanças relevantes serão avisadas no app ou por e-mail, e a data de atualização aparece no topo.",
        ],
      },
      {
        title: "16. Lei e foro",
        paragraphs: ["Aplica-se a lei brasileira. Fica eleito o foro do domicílio do consumidor."],
      },
      { title: "17. Contato", paragraphs: ["evoluirmaisoficial@hotmail.com"] },
    ],
  },
  en: {
    title: "Terms of Use",
    updated: "Last updated: October 5, 2026",
    back: "Back",
    translationNote: "This is a translation. In case of conflict, the Portuguese version prevails.",
    sections: [
      {
        title: "1. Who we are",
        paragraphs: [
          "Evoluir+ English AI (evoluirmaisenglishai.com) is an English-learning service supported by artificial intelligence, offered by Marcelo Neves Nicodemos. Contact: evoluirmaisoficial@hotmail.com.",
        ],
      },
      {
        title: "2. Acceptance",
        paragraphs: [
          "By creating an account or using the service, you agree to these Terms and the Privacy Policy. If you do not agree, do not use the service.",
        ],
      },
      {
        title: "3. Account",
        paragraphs: [
          "You must provide accurate information, keep your password confidential, and notify us if you suspect misuse. You are responsible for activities carried out through your account.",
        ],
      },
      {
        title: "4. Minors",
        paragraphs: [
          "People under 18 may use the service with the knowledge and authorization of a parent or legal guardian, who is responsible for its use and for purchasing paid plans. Children under 12 may use the service only with the specific consent of a parent or legal guardian, in accordance with Brazil's General Data Protection Law (LGPD).",
        ],
      },
      {
        title: "5. The service",
        paragraphs: [
          "We offer lessons, vocabulary, reading, writing, listening and speaking practice, and conversations with artificial intelligence assistants (EVO). Content and features may be changed, expanded, or removed.",
        ],
      },
      {
        title: "6. Artificial intelligence",
        paragraphs: [
          "Responses, corrections, and assessments are generated automatically and may contain errors. They do not replace a teacher, certification, or official proficiency assessment. The Common European Framework (CEFR) levels shown are estimates.",
        ],
      },
      {
        title: "7. Plans and payments",
        paragraphs: [
          'There is a free plan and a monthly or annual Premium plan, with prices shown on the subscription page. Payments are processed by Stripe, and we do not store your card details. The subscription renews automatically until canceled. You may cancel at any time under "My subscription" and retain access until the end of the period already paid for.',
        ],
      },
      {
        title: "8. Right of withdrawal",
        paragraphs: [
          "Under Article 49 of the Brazilian Consumer Protection Code, you may withdraw from the purchase within 7 days and receive a full refund by contacting us by email.",
        ],
      },
      {
        title: "9. Permitted use",
        paragraphs: [
          "You may not use the service for illegal purposes; attempt to access third-party accounts or data; circumvent limits, payments, or security measures; submit offensive or discriminatory content or content that infringes third-party rights; or use automation to extract content.",
        ],
      },
      {
        title: "10. Your content",
        paragraphs: [
          "The texts, voice recordings, and responses you submit remain yours. You authorize us to process them solely to provide the service (corrections, assessments, and progress tracking), in accordance with the Privacy Policy.",
        ],
      },
      {
        title: "11. Intellectual property",
        paragraphs: [
          "The Evoluir+ brand, the EVO character, lessons, materials, and software belong to us or are licensed to us. Use is personal and non-commercial.",
        ],
      },
      {
        title: "12. Availability",
        paragraphs: [
          "We seek to keep the service available, but interruptions may occur for maintenance or due to failures by providers of hosting, artificial intelligence, or payment services.",
        ],
      },
      {
        title: "13. Termination",
        paragraphs: [
          "You may close your account at any time by contacting us by email. We may suspend accounts that violate these Terms, with prior notice whenever possible.",
        ],
      },
      {
        title: "14. Liability",
        paragraphs: [
          "To the extent permitted by law, we are not liable for indirect damages arising from use of the service. Nothing in these Terms limits rights guaranteed by the Brazilian Consumer Protection Code.",
        ],
      },
      {
        title: "15. Changes",
        paragraphs: [
          "We may update these Terms. Material changes will be communicated in the app or by email, and the update date appears at the top.",
        ],
      },
      {
        title: "16. Governing law and venue",
        paragraphs: [
          "Brazilian law applies. The courts of the consumer's place of residence shall have jurisdiction.",
        ],
      },
      { title: "17. Contact", paragraphs: ["evoluirmaisoficial@hotmail.com"] },
    ],
  },
};

const privacy: Record<UiLang, LegalDocument> = {
  pt: {
    title: "Política de Privacidade",
    updated: "Última atualização: 5 de outubro de 2026",
    back: "Voltar",
    sections: [
      {
        title: "1. Controlador",
        paragraphs: [
          "Marcelo Neves Nicodemos, responsável pelo Evoluir+ English AI. Canal para assuntos de privacidade: evoluirmaisoficial@hotmail.com.",
        ],
      },
      {
        title: "2. Dados que coletamos",
        lettered: [
          "Cadastro: nome, e-mail e senha (armazenada de forma protegida pelo provedor de autenticação).",
          "Perfil de estudo: nível, objetivos, meta diária, idioma e preferências.",
          "Uso e aprendizado: aulas concluídas, respostas, notas, tempo de estudo, sequência de dias, erros frequentes e palavras estudadas.",
          "Conteúdo enviado: textos escritos, mensagens aos assistentes de IA e gravações de voz para transcrição e avaliação de pronúncia. As gravações de voz não são armazenadas por nós: são enviadas para processamento e descartadas em seguida.",
          "Pagamento: plano, status e histórico da assinatura, informados pela Stripe. Os dados do cartão ficam somente com a Stripe.",
          "Dados técnicos: tipo de dispositivo e navegador, registros de acesso e de erros e, se você ativar, o identificador para notificações. Quando ocorre um erro no app, registramos a descrição técnica do erro, a página em que ele aconteceu e o identificador interno da sua conta, sem nome, e-mail ou conteúdo das aulas.",
          "Armazenamento local: preferências como idioma, tema e rascunhos ficam salvas no seu navegador.",
        ],
      },
      {
        title: "3. Para que usamos e com qual base legal",
        bullets: [
          "Prestar o serviço, personalizar o estudo e medir o progresso: execução de contrato e legítimo interesse.",
          "Cobrança e emissão de registros: execução de contrato e cumprimento de obrigação legal.",
          "Notificações e lembretes: consentimento, que você pode retirar a qualquer momento nas configurações.",
          "Segurança e prevenção de fraudes: legítimo interesse.",
        ],
      },
      {
        title: "4. Com quem compartilhamos",
        paragraphs: [
          "Somente com fornecedores necessários para o serviço funcionar: Supabase (hospedagem, banco de dados e autenticação), Lovable (plataforma do app e intermediação dos serviços de IA), Google (modelos Gemini, para processar texto e voz), Stripe (pagamentos) e Sentry (registro de erros técnicos do app, sem o conteúdo das aulas, textos ou áudios). Não vendemos seus dados. Podemos compartilhar dados com autoridades quando exigido por lei.",
        ],
      },
      {
        title: "5. Transferência internacional",
        paragraphs: [
          "Esses fornecedores podem processar dados fora do Brasil, com as garantias previstas no art. 33 da LGPD.",
        ],
      },
      {
        title: "6. Por quanto tempo guardamos",
        paragraphs: [
          "Enquanto sua conta existir. Após a exclusão da conta, eliminamos ou anonimizamos os dados em até 30 dias, exceto quando a lei exigir a guarda, como os registros de acesso mantidos por 6 meses (Marco Civil da Internet, art. 15) e os dados fiscais pelo prazo legal.",
        ],
      },
      {
        title: "7. Segurança",
        paragraphs: [
          "Cada aluno acessa apenas os próprios dados, as conexões são criptografadas e o acesso ao banco é controlado por permissões. Nenhum sistema é totalmente seguro. Em caso de incidente relevante, comunicaremos os afetados e a autoridade, conforme a lei.",
        ],
      },
      {
        title: "8. Seus direitos (art. 18 da LGPD)",
        paragraphs: [
          "Você pode pedir: confirmação e acesso aos seus dados, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, eliminação dos dados tratados com consentimento, informação sobre compartilhamento e revogação do consentimento. Você também pode pedir a revisão de decisões tomadas apenas com base em tratamento automatizado, como avaliações feitas pela IA (art. 20). Responderemos em até 15 dias pelo e-mail de contato. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
        ],
      },
      {
        title: "9. Crianças e adolescentes",
        paragraphs: [
          "Tratamos dados de crianças e adolescentes no seu melhor interesse (art. 14 da LGPD). Dados de menores de 12 anos só são tratados com o consentimento específico de um dos pais ou do responsável legal, que pode pedir acesso ou exclusão a qualquer momento.",
        ],
      },
      {
        title: "10. Cookies e armazenamento local",
        paragraphs: [
          "Usamos cookies e armazenamento local essenciais para manter o login e as preferências. Não usamos cookies de publicidade nem de análise.",
        ],
      },
      {
        title: "11. Alterações",
        paragraphs: [
          "Podemos atualizar esta Política. Mudanças relevantes serão avisadas no app ou por e-mail.",
        ],
      },
      { title: "12. Contato", paragraphs: ["evoluirmaisoficial@hotmail.com"] },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: October 5, 2026",
    back: "Back",
    translationNote: "This is a translation. In case of conflict, the Portuguese version prevails.",
    sections: [
      {
        title: "1. Data controller",
        paragraphs: [
          "Marcelo Neves Nicodemos is responsible for Evoluir+ English AI. Privacy contact: evoluirmaisoficial@hotmail.com.",
        ],
      },
      {
        title: "2. Data we collect",
        lettered: [
          "Registration: name, email address, and password (stored securely by the authentication provider).",
          "Study profile: level, goals, daily target, language, and preferences.",
          "Use and learning: completed lessons, responses, scores, study time, day streak, frequent mistakes, and words studied.",
          "Submitted content: written texts, messages to AI assistants, and voice recordings for transcription and pronunciation assessment. Voice recordings are not stored by us: they are sent for processing and then discarded.",
          "Payment: subscription plan, status, and history provided by Stripe. Card details remain solely with Stripe.",
          "Technical data: device and browser type, access and error logs, and, if you enable it, the notification identifier. When an error occurs in the app, we record the technical description of the error, the page where it happened, and your account's internal identifier — without name, email, or lesson content.",
          "Local storage: preferences such as language, theme, and drafts are stored in your browser.",
        ],
      },
      {
        title: "3. How and why we use data, and our legal basis",
        bullets: [
          "To provide the service, personalize study, and measure progress: performance of a contract and legitimate interests.",
          "To process payments and issue records: performance of a contract and compliance with legal obligations.",
          "For notifications and reminders: consent, which you may withdraw at any time in settings.",
          "For security and fraud prevention: legitimate interests.",
        ],
      },
      {
        title: "4. Who we share data with",
        paragraphs: [
          "Only with providers required for the service to operate: Supabase (hosting, database, and authentication), Lovable (app platform and intermediary for AI services), Google (Gemini models, to process text and voice), Stripe (payments), and Sentry (technical error logging for the app, without lesson content, texts, or audio). We do not sell your data. We may share data with authorities when required by law.",
        ],
      },
      {
        title: "5. International transfers",
        paragraphs: [
          "These providers may process data outside Brazil, with the safeguards set out in Article 33 of the LGPD.",
        ],
      },
      {
        title: "6. How long we retain data",
        paragraphs: [
          "For as long as your account exists. After account deletion, we delete or anonymize data within 30 days, except where retention is required by law, such as access logs retained for 6 months (Article 15 of the Brazilian Civil Rights Framework for the Internet) and tax data retained for the legally required period.",
        ],
      },
      {
        title: "7. Security",
        paragraphs: [
          "Each student can access only their own data, connections are encrypted, and database access is controlled by permissions. No system is completely secure. In the event of a relevant incident, we will notify affected individuals and the authority as required by law.",
        ],
      },
      {
        title: "8. Your rights (Article 18 of the LGPD)",
        paragraphs: [
          "You may request confirmation and access to your data; correction; anonymization, blocking, or deletion of unnecessary data; portability; deletion of data processed with consent; information about sharing; and withdrawal of consent. You may also request a review of decisions made solely on the basis of automated processing, such as AI assessments (Article 20). We will respond within 15 days through the contact email. You may also lodge a complaint with Brazil's National Data Protection Authority (ANPD).",
        ],
      },
      {
        title: "9. Children and adolescents",
        paragraphs: [
          "We process data concerning children and adolescents in their best interests (Article 14 of the LGPD). Data concerning children under 12 is processed only with the specific consent of a parent or legal guardian, who may request access or deletion at any time.",
        ],
      },
      {
        title: "10. Cookies and local storage",
        paragraphs: [
          "We use cookies and local storage that are essential to maintain login and preferences. We do not use advertising or analytics cookies.",
        ],
      },
      {
        title: "11. Changes",
        paragraphs: [
          "We may update this Policy. Material changes will be communicated in the app or by email.",
        ],
      },
      { title: "12. Contact", paragraphs: ["evoluirmaisoficial@hotmail.com"] },
    ],
  },
};

export function LegalDocumentPage({ kind }: { kind: "terms" | "privacy" }) {
  const { lang } = useUiLang();
  const document = kind === "terms" ? terms[lang] : privacy[lang];

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  }

  return (
    <div className="dashboard-shell brand-dashboard-theme dark flex min-h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <article className="mx-auto max-w-3xl">
          <Button type="button" variant="ghost" size="sm" className="mb-8 -ml-3" onClick={goBack}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {document.back}
          </Button>

          <header className="border-b border-border pb-8">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{document.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{document.updated}</p>
            {document.translationNote ? (
              <p className="mt-5 border-l-2 border-success pl-4 text-sm leading-relaxed text-muted-foreground">
                {document.translationNote}
              </p>
            ) : null}
          </header>

          <div className="space-y-9 py-10">
            {document.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-3 space-y-2 pl-5 text-sm leading-7 text-muted-foreground sm:text-base">
                    {section.bullets.map((item) => (
                      <li key={item} className="list-disc pl-1">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.lettered ? (
                  <ol
                    type="a"
                    className="mt-3 space-y-2 pl-6 text-sm leading-7 text-muted-foreground sm:text-base"
                  >
                    {section.lettered.map((item) => (
                      <li key={item} className="pl-1">
                        {item}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </main>
      <Footer minimal lang={lang} />
    </div>
  );
}

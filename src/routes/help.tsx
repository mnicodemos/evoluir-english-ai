import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookMarked,
  BookOpen,
  CreditCard,
  HelpCircle,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageCircle,
  Search,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { useUiLang } from "@/lib/uiLang";
import { PageHeader } from "@/components/PageHeader";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda | Evoluir+ English AI" },
      {
        name: "description",
        content: "Encontre respostas sobre sua conta, assinatura e uso do Evoluir+ English AI.",
      },
    ],
  }),
  component: HelpCenterPage,
});

type HelpTopic = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

function HelpCenterPage() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<string[]>([]);

  const topics: HelpTopic[] = pt
    ? [
        {
          id: "login",
          category: "Conta e acesso",
          question: "Não consigo entrar na minha conta. O que faço?",
          answer:
            "Confira se está usando o mesmo e-mail cadastrado no Evoluir+. Se a senha não for aceita, abra a tela de acesso e escolha a opção de recuperação de senha. Se continuar sem conseguir entrar, envie uma mensagem ao suporte informando o e-mail da conta e o que aparece na tela.",
        },
        {
          id: "password",
          category: "Conta e acesso",
          question: "Como redefino minha senha?",
          answer:
            "Na tela de acesso, use a opção de recuperação de senha e siga o link enviado ao seu e-mail. Se a mensagem não chegar, confira também as pastas de spam e promoções.",
        },
        {
          id: "profile",
          category: "Conta e acesso",
          question: "Como altero meus dados ou meu nível de inglês?",
          answer:
            "As preferências disponíveis ficam nas opções do seu perfil. O nível exibido considera as evidências de aprendizagem registradas nas atividades e respeita o nível do conteúdo praticado.",
        },
        {
          id: "plans",
          category: "Planos e pagamentos",
          question: "Onde vejo meu plano e minha assinatura?",
          answer:
            "Depois de entrar no aplicativo, abra Minha assinatura. Nessa área você pode consultar o plano e o status da assinatura.",
        },
        {
          id: "cancel",
          category: "Planos e pagamentos",
          question: "Como gerencio ou cancelo minha assinatura?",
          answer:
            "Acesse Minha assinatura dentro do aplicativo e use a opção de gerenciamento da assinatura. O gerenciamento é feito pelo portal seguro de cobrança.",
        },
        {
          id: "lessons",
          category: "Uso da plataforma",
          question: "Onde encontro minhas aulas e atividades?",
          answer:
            "No menu do aplicativo, abra Learning para acessar a trilha de aulas do seu nível. As demais áreas, como Vocabulary, Listening, Reading, Writing e AI Speaking, oferecem práticas específicas.",
        },
        {
          id: "progress",
          category: "Uso da plataforma",
          question: "Meu progresso não foi atualizado. Como devo proceder?",
          answer:
            "Aguarde alguns instantes e atualize a tela. Se a atividade continuar sem aparecer, anote o nome da atividade, o dia e o horário aproximado em que a concluiu e envie essas informações ao suporte para análise.",
        },
        {
          id: "ai",
          category: "Uso da plataforma",
          question: "Como descubro para que serve cada recurso?",
          answer:
            "Abra App guide no menu do aplicativo. O guia explica as principais áreas e mostra como usar cada recurso passo a passo.",
        },
      ]
    : [
        {
          id: "login",
          category: "Account and access",
          question: "I can't sign in to my account. What should I do?",
          answer:
            "Make sure you are using the same email address registered with Evoluir+. If your password is not accepted, open the sign-in page and choose the password recovery option. If you still cannot access your account, email Support with your account email and a description of what you see.",
        },
        {
          id: "password",
          category: "Account and access",
          question: "How do I reset my password?",
          answer:
            "On the sign-in page, use the password recovery option and follow the link sent to your email. If the message does not arrive, also check your spam and promotions folders.",
        },
        {
          id: "profile",
          category: "Account and access",
          question: "How do I change my details or English level?",
          answer:
            "Available preferences are in your profile options. Your displayed level is based on learning evidence recorded through activities and does not exceed the level of the content you have practised.",
        },
        {
          id: "plans",
          category: "Plans and payments",
          question: "Where can I see my plan and subscription?",
          answer:
            "After signing in to the app, open My Subscription to check your plan and subscription status.",
        },
        {
          id: "cancel",
          category: "Plans and payments",
          question: "How do I manage or cancel my subscription?",
          answer:
            "Open My Subscription in the app and choose the subscription management option. Management takes place in the secure billing portal.",
        },
        {
          id: "lessons",
          category: "Using the platform",
          question: "Where can I find my lessons and activities?",
          answer:
            "Open Learning in the app menu to access the lesson path for your level. Other areas, such as Vocabulary, Listening, Reading, Writing and AI Speaking, offer focused practice.",
        },
        {
          id: "progress",
          category: "Using the platform",
          question: "My progress has not updated. What should I do?",
          answer:
            "Wait a moment and refresh the page. If the activity still does not appear, note its name and the approximate date and time you completed it, then send those details to Support for review.",
        },
        {
          id: "ai",
          category: "Using the platform",
          question: "How can I learn what each feature does?",
          answer:
            "Open App guide in the app menu. It explains the main areas and shows you how to use each feature step by step.",
        },
      ];

  const normalizedQuery = query
    .trim()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase();
  const filteredTopics = normalizedQuery
    ? topics.filter((topic) =>
        `${topic.category} ${topic.question} ${topic.answer}`
          .normalize("NFD")
          .replace(/[\\u0300-\\u036f]/g, "")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : topics;

  const categories = [...new Set(filteredTopics.map((topic) => topic.category))];
  const categoryIcon = (category: string) => {
    if (category.includes("Conta") || category.includes("Account")) return LockKeyhole;
    if (category.includes("pagamento") || category.includes("payments")) return CreditCard;
    return BookOpen;
  };
  const supportSubject = pt
    ? "Solicitação de suporte — Evoluir+ English AI"
    : "Support request — Evoluir+ English AI";
  const supportBody = pt
    ? "Olá, equipe Evoluir+!\n\nE-mail da minha conta:\nAssunto:\nO que aconteceu:\nDispositivo/navegador:\n\nObrigado(a)."
    : "Hello Evoluir+ team,\n\nAccount email:\nSubject:\nWhat happened:\nDevice/browser:\n\nThank you.";

  return (
    <AppShell>
      <PageHeader
        icon={LifeBuoy}
        title={pt ? "Ajuda e suporte" : "Help & Support"}
        description={
          pt
            ? "Encontre respostas sobre sua conta, assinatura e uso da plataforma."
            : "Find answers about your account, subscription and using the platform."
        }
      />
      <div className="card-soft mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {pt ? "Conheça os recursos do aplicativo" : "Explore the app features"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pt ? "Consulte o guia passo a passo." : "Read the step-by-step app guide."}
          </p>
        </div>
        <Link to="/guide" className="text-sm font-semibold text-brand-green hover:underline">
          {pt ? "Abrir App Guide" : "Open App Guide"} →
        </Link>
      </div>
      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={pt ? "Pesquise uma dúvida..." : "Search for an answer..."}
          aria-label={pt ? "Pesquisar na Central de Ajuda" : "Search the Help Center"}
          className="h-11 pl-10"
        />
      </div>

      <section id="help-faq" className="mt-4 scroll-mt-4 space-y-4">
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {pt
              ? "Não encontramos uma resposta. Tente outras palavras ou fale com o suporte."
              : "No answer found. Try different words or contact Support."}
          </p>
        ) : (
          categories.map((category) => {
            const Icon = categoryIcon(category);
            return (
              <div key={category}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
                  <Icon className="size-4 text-brand-green" aria-hidden="true" />
                  {category}
                </h2>
                <Accordion
                  type="multiple"
                  value={openItems}
                  onValueChange={setOpenItems}
                  className="rounded-2xl border border-border bg-card px-4 sm:px-5"
                >
                  {filteredTopics
                    .filter((topic) => topic.category === category)
                    .map((topic) => (
                      <AccordionItem key={topic.id} value={topic.id}>
                        <AccordionTrigger className="py-4 text-left text-sm font-medium hover:no-underline">
                          {topic.question}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 text-sm leading-6 text-muted-foreground">
                          {topic.answer}
                          {topic.id === "login" || topic.id === "password" ? (
                            <Link
                              to="/auth"
                              className="mt-2 inline-flex font-semibold text-brand-green hover:underline"
                            >
                              {pt ? "Abrir acesso à conta" : "Open sign in"}
                            </Link>
                          ) : null}
                          {topic.id === "plans" || topic.id === "cancel" ? (
                            <Link
                              to="/auth"
                              className="mt-2 inline-flex font-semibold text-brand-green hover:underline"
                            >
                              {pt ? "Entrar no aplicativo" : "Sign in to the app"}
                            </Link>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              </div>
            );
          })
        )}
      </section>

      <section className="card-soft mt-5 p-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/12 text-brand-green">
              <MessageCircle className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">
                {pt ? "Ainda precisa de ajuda?" : "Still need help?"}
              </h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {pt
                  ? "Nossa equipe pode ajudar com dúvidas e dificuldades na plataforma."
                  : "Our team can help with questions and platform issues."}
              </p>
            </div>
          </div>
          <a
            href={`mailto:suporte@evoluirmaisenglishai.com?subject=${encodeURIComponent(supportSubject)}&body=${encodeURIComponent(supportBody)}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Mail className="size-4" aria-hidden="true" />
            {pt ? "Falar com o suporte" : "Contact Support"}
          </a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {pt ? "E-mail de suporte:" : "Support email:"}{" "}
          <a
            href="mailto:suporte@evoluirmaisenglishai.com"
            className="font-medium text-foreground underline underline-offset-4"
          >
            suporte@evoluirmaisenglishai.com
          </a>
        </p>
      </section>

      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <HelpCircle className="size-3.5" aria-hidden="true" />
        {pt
          ? "As respostas são atualizadas conforme os recursos disponíveis no aplicativo."
          : "Answers reflect the features currently available in the app."}
      </div>
    </AppShell>
  );
}

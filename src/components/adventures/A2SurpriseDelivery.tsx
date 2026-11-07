/* eslint-disable prettier/prettier */
import { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { EnglishAdventureJourneyMap } from "@/components/adventures/EnglishAdventureJourneyMap";
import { AdventureMusicControl } from "@/components/adventures/AdventureMusicControl";
import { EnglishAdventuresAvatar } from "@/components/EnglishAdventuresAvatar";
import { Button } from "@/components/ui/button";
import { useAdventureActivityTimer, useEnglishAdventuresProgress } from "@/hooks/useEnglishAdventuresProgress";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type Choice = {
  label: string;
  response: string;
  coaching: string;
  consequence: "replacement" | "refund" | "more-info" | "follow-up" | "polite";
};

type Scene = {
  place: string;
  story: string;
  choices: Choice[];
  evo: string;
};

const scenes: Scene[] = [
  {
    place: "A delivery at the door",
    story: "EVO is waiting with you for a package. You ordered a portable speaker for the neighbourhood music afternoon. The delivery driver arrives, but the box is wet and one corner is badly damaged. “Here you are,” he says. What do you say?",
    choices: [
      { label: "“I'm afraid the package is damaged. Could you take a look?”", response: "The driver checks the box with you. “You're right. I can make a note of the damage before you accept it.”", coaching: "“I'm afraid…” softens a problem. “Could you…?” makes a polite request.", consequence: "polite" },
      { label: "“This is not what I ordered!”", response: "The driver understands that you're unhappy, but he cannot see what is wrong yet. He asks you to explain.", coaching: "Your message is understandable. Add a specific detail so the other person knows what happened.", consequence: "more-info" },
      { label: "“I'll accept it and contact the shop later.”", response: "The driver leaves. You take a photo of the wet box before opening it, just in case you need to report the damage.", coaching: "You chose to collect evidence first. A photo and the order details can help when you contact the shop.", consequence: "follow-up" },
    ],
    evo: "There isn't just one way to handle a problem. Your choice changes how the conversation begins.",
  },
  {
    place: "What happened inside?",
    story: "You open the package. The speaker turns on, but the sound is distorted and the charging cable is missing. EVO asks: “How shall we explain the problem to customer support?”",
    choices: [
      { label: "“The speaker doesn't work properly, and the cable is missing.”", response: "EVO nods. “That's clear. You described two separate problems.”", coaching: "Use the present simple with “doesn't” to describe how a product works. “Is missing” describes something that isn't there.", consequence: "more-info" },
      { label: "“The speaker was perfect and everything is here.”", response: "The support agent would think there is no problem. You decide to check the package again and explain honestly what you found.", coaching: "Be accurate when describing a problem. Say what works and what doesn't.", consequence: "follow-up" },
      { label: "“I received it yesterday, but I haven't tested it until now.”", response: "The agent understands when you received the package and when you tested it. They ask what happened during the test.", coaching: "“I received” tells when it arrived. “I haven't tested” connects the past with the situation now.", consequence: "polite" },
    ],
    evo: "Useful detail makes a complaint easier to understand: say what is wrong, what is missing and when you noticed it.",
  },
  {
    place: "A message to the shop",
    story: "The shop replies: “We're sorry about that. Could you send us the order number and tell us what you would prefer?” You and EVO look at the options.",
    choices: [
      { label: "“I'd prefer a replacement, please. I still need the speaker.”", response: "The agent checks the stock and says a new speaker is available. They explain that it can be sent tomorrow.", coaching: "“I'd prefer…” is a natural way to say which option you want. “I still need…” explains why.", consequence: "replacement" },
      { label: "“A refund would be better for me, please.”", response: "The agent explains the refund process and asks you to confirm the payment method.", coaching: "“Would be better for me” is a polite way to express a preference.", consequence: "refund" },
      { label: "“Could you tell me what my options are?”", response: "The agent explains the replacement and refund options, including how long each one takes.", coaching: "When you need more information, “Could you tell me…?” keeps the conversation polite.", consequence: "more-info" },
    ],
    evo: "You can ask for what you need, choose an option or request more information. Each is a useful real-life strategy.",
  },
  {
    place: "A small complication",
    story: "There is one more detail. The music afternoon is on Saturday, and today is Thursday. The shop says a replacement usually takes two to four working days. What would you like to ask?",
    choices: [
      { label: "“Is there any chance it could arrive by Saturday?”", response: "The agent checks express delivery. “We can try, but I can't promise it.”", coaching: "“Is there any chance…?” is a tactful way to ask about a possibility.", consequence: "follow-up" },
      { label: "“Could you confirm the delivery date before I decide?”", response: "The agent checks the delivery options and gives you a clearer estimate before you make your decision.", coaching: "“Could you confirm…?” asks for specific information before you choose.", consequence: "more-info" },
      { label: "“That's fine. I can wait a few more days.”", response: "The agent appreciates your flexibility and confirms the standard delivery window.", coaching: "“I can wait” communicates that the proposed time is acceptable.", consequence: "polite" },
    ],
    evo: "A good conversation includes checking dates and expectations, not only choosing a product.",
  },
  {
    place: "The final confirmation",
    story: "The agent is ready to close the request. Before ending the conversation, you want to make sure the next step is clear. What do you say?",
    choices: [
      { label: "“Thank you. Could you email me the confirmation, please?”", response: "“Of course. You'll receive an email with the details shortly,” the agent replies.", coaching: "Ask for written confirmation so you can check the details later.", consequence: "replacement" },
      { label: "“So, what happens next?”", response: "The agent summarises the next step and tells you when to expect an update.", coaching: "This is a simple, natural question when you need the next step explained.", consequence: "more-info" },
      { label: "“Thanks for your help. Have a good day!”", response: "The agent thanks you too. The conversation ends on a friendly note.", coaching: "A polite closing helps keep customer conversations positive.", consequence: "polite" },
    ],
    evo: "Before you finish, check that you know what will happen next and when.",
  },
  {
    place: "Preparing for the replacement",
    story: "The shop confirms that a replacement speaker will arrive tomorrow. You need to return the damaged one. The agent asks whether you have the original packaging. What do you explain?",
    choices: [
      { label: "“I still have the original box and all the accessories.”", response: "“Perfect. Please put the speaker and the accessories in the box,” the agent explains.", coaching: "Use “still have” to say that something remains in your possession.", consequence: "replacement" },
      { label: "“I have threw the box away.”", response: "The agent asks whether you can use another safe box for the return.", coaching: "The present perfect is “I have thrown”, not “I have threw”.", consequence: "more-info" },
      { label: "“The box is more damaged that the speaker.”", response: "The agent asks you to describe the condition of both items.", coaching: "Use “than” in comparisons: “more damaged than”.", consequence: "follow-up" },
    ],
    evo: "When you explain what you still have, the other person can tell you exactly how to proceed.",
  },
  {
    place: "Arranging collection",
    story: "The courier can collect the damaged speaker on Friday morning or Friday afternoon. You will be at work in the morning. Which option do you choose?",
    choices: [
      { label: "“Friday afternoon would be more convenient for me.”", response: "The courier books the collection for Friday afternoon.", coaching: "“Would be more convenient” is a polite way to express a preference.", consequence: "replacement" },
      { label: "“I am available in the morning yesterday.”", response: "The courier asks you to confirm whether you mean this Friday.", coaching: "Use “will be available” for a future arrangement, not “yesterday”.", consequence: "follow-up" },
      { label: "“You collect it whenever.”", response: "The courier asks for a time window so the collection can be arranged.", coaching: "Give a clear time preference when arranging an appointment.", consequence: "more-info" },
    ],
    evo: "Clear availability makes appointments easier to arrange.",
  },
  {
    place: "An unexpected update",
    story: "On Friday, the courier sends a message saying the collection will be one hour late. You have another appointment. What do you reply?",
    choices: [
      { label: "“Thanks for letting me know. Could we choose another time?”", response: "The courier offers a new collection window for the next morning.", coaching: "“Thanks for letting me know” acknowledges an update. “Could we…?” opens a polite negotiation.", consequence: "follow-up" },
      { label: "“You are late always.”", response: "The courier asks what alternative time would work for you.", coaching: "Use “You are always late” for a general complaint, but a specific request is more useful here.", consequence: "more-info" },
      { label: "“I don't need the collection never.”", response: "The courier checks whether you want to cancel the return or change the time.", coaching: "Use “I don't need the collection anymore” to say that something is no longer necessary.", consequence: "refund" },
    ],
    evo: "A calm, specific request can solve a scheduling problem without creating another one.",
  },
  {
    place: "The new speaker arrives",
    story: "The replacement arrives. You open the box and test the speaker. The sound is clear, the cable is included and everything works. How do you update the shop?",
    choices: [
      { label: "“The replacement has arrived, and everything is working properly now.”", response: "The agent is pleased to hear that the replacement solved the problem.", coaching: "Use the present perfect to report a recent result that matters now: “has arrived”.", consequence: "replacement" },
      { label: "“The speaker don't works.”", response: "The agent asks whether you are reporting a new problem or confirming the delivery.", coaching: "Say “The speaker doesn't work” or “The speaker works”. Do not add -s after “doesn't”.", consequence: "more-info" },
      { label: "“I am receive the speaker tomorrow.”", response: "The agent checks the delivery record and asks you to confirm the date.", coaching: "Say “I received the speaker” for a completed event or “I will receive it” for the future.", consequence: "follow-up" },
    ],
    evo: "You can now describe the result clearly and close the conversation with confidence.",
  },
  {
    place: "Closing the case",
    story: "The shop asks whether you are happy with the solution. You want to thank the agent and explain what made the service helpful. What do you say?",
    choices: [
      { label: "“Thank you for your help. The updates made the process much easier.”", response: "The agent thanks you for the feedback and closes the support request.", coaching: "Use the past simple “made” to describe how the updates affected the process.", consequence: "polite" },
      { label: "“The updates was very useful.”", response: "The agent understands your feedback and appreciates the comment.", coaching: "Use “were” with the plural subject “updates”.", consequence: "more-info" },
      { label: "“I am happy because you helped me yesterday and tomorrow.”", response: "The agent asks which part of the service you found most helpful.", coaching: "Keep the time reference consistent. You can say “You helped me throughout the process”.", consequence: "follow-up" },
    ],
    evo: "You explained a problem, negotiated a solution, arranged a collection and evaluated the result. Well done!",
  },
];


const portugueseTranslations: Record<string, string> = {
  "A delivery at the door": "Uma entrega à porta",
  "EVO is waiting with you for a package. You ordered a portable speaker for the neighbourhood music afternoon. The delivery driver arrives, but the box is wet and one corner is badly damaged. “Here you are,” he says. What do you say?": "EVO está esperando com você por uma encomenda. Você pediu uma caixa de som portátil para a tarde musical do bairro. O entregador chega, mas a caixa está molhada e um dos cantos está bastante danificado. “Aqui está”, ele diz. O que você responde?",
  "“I'm afraid the package is damaged. Could you take a look?”": "“Receio que a encomenda esteja danificada. Você poderia dar uma olhada?”",
  "“This is not what I ordered!”": "“Não foi isso que eu pedi!”",
  "“I'll accept it and contact the shop later.”": "“Vou aceitar e entrar em contato com a loja depois.”",
  "The driver checks the box with you. “You're right. I can make a note of the damage before you accept it.”": "O entregador verifica a caixa com você. “Você tem razão. Posso registrar o dano antes de você aceitar a encomenda.”",
  "The driver understands that you're unhappy, but he cannot see what is wrong yet. He asks you to explain.": "O entregador percebe que você está insatisfeito, mas ainda não consegue identificar o problema. Ele pede que você explique.",
  "The driver leaves. You take a photo of the wet box before opening it, just in case you need to report the damage.": "O entregador vai embora. Você tira uma foto da caixa molhada antes de abri-la, caso precise comunicar o dano.",
  "“I'm afraid…” softens a problem. “Could you…?” makes a polite request.": "“I'm afraid…” suaviza a maneira de apresentar um problema. “Could you…?” é uma forma educada de fazer um pedido.",
  "Your message is understandable. Add a specific detail so the other person knows what happened.": "Sua mensagem é compreensível. Acrescente um detalhe específico para que a outra pessoa saiba o que aconteceu.",
  "You chose to collect evidence first. A photo and the order details can help when you contact the shop.": "Você escolheu reunir provas primeiro. Uma foto e os dados do pedido podem ajudar quando entrar em contato com a loja.",
  "There isn't just one way to handle a problem. Your choice changes how the conversation begins.": "Não existe apenas uma maneira de resolver um problema. Sua escolha muda a forma como a conversa começa.",
  "What happened inside?": "O que aconteceu dentro da embalagem?",
  "You open the package. The speaker turns on, but the sound is distorted and the charging cable is missing. EVO asks: “How shall we explain the problem to customer support?”": "Você abre a embalagem. A caixa de som liga, mas o som está distorcido e o cabo de carregamento está faltando. EVO pergunta: “Como devemos explicar o problema ao atendimento ao cliente?”",
  "“The speaker doesn't work properly, and the cable is missing.”": "“A caixa de som não funciona direito e o cabo está faltando.”",
  "“The speaker was perfect and everything is here.”": "“A caixa de som estava perfeita e está tudo aqui.”",
  "“I received it yesterday, but I haven't tested it until now.”": "“Recebi ontem, mas só testei agora.”",
  "EVO nods. “That's clear. You described two separate problems.”": "EVO concorda. “Está claro. Você descreveu dois problemas diferentes.”",
  "The support agent would think there is no problem. You decide to check the package again and explain honestly what you found.": "O atendente pensaria que não há nenhum problema. Você decide verificar a embalagem novamente e explicar com sinceridade o que encontrou.",
  "The agent understands when you received the package and when you tested it. They ask what happened during the test.": "O atendente entende quando você recebeu a encomenda e quando a testou. Ele pergunta o que aconteceu durante o teste.",
  "Use the present simple with “doesn't” to describe how a product works. “Is missing” describes something that isn't there.": "Use o presente simples com “doesn't” para descrever como um produto funciona. “Is missing” descreve algo que está faltando.",
  "Be accurate when describing a problem. Say what works and what doesn't.": "Seja preciso ao descrever um problema. Diga o que funciona e o que não funciona.",
  "“I received” tells when it arrived. “I haven't tested” connects the past with the situation now.": "“I received” informa quando chegou. “I haven't tested” conecta o passado à situação atual.",
  "Useful detail makes a complaint easier to understand: say what is wrong, what is missing and when you noticed it.": "Detalhes úteis tornam uma reclamação mais fácil de entender: diga o que está errado, o que está faltando e quando você percebeu.",
  "A message to the shop": "Uma mensagem para a loja",
  "The shop replies: “We're sorry about that. Could you send us the order number and tell us what you would prefer?” You and EVO look at the options.": "A loja responde: “Sentimos muito por isso. Você poderia nos enviar o número do pedido e dizer qual seria sua preferência?” Você e EVO analisam as opções.",
  "“I'd prefer a replacement, please. I still need the speaker.”": "“Eu preferiria uma substituição, por favor. Ainda preciso da caixa de som.”",
  "“A refund would be better for me, please.”": "“Um reembolso seria melhor para mim, por favor.”",
  "“Could you tell me what my options are?”": "“Você poderia me dizer quais são as minhas opções?”",
  "The agent checks the stock and says a new speaker is available. They explain that it can be sent tomorrow.": "O atendente verifica o estoque e diz que há uma nova caixa de som disponível. Ele explica que ela pode ser enviada amanhã.",
  "The agent explains the refund process and asks you to confirm the payment method.": "O atendente explica o processo de reembolso e pede que você confirme a forma de pagamento.",
  "The agent explains the replacement and refund options, including how long each one takes.": "O atendente explica as opções de substituição e reembolso, incluindo quanto tempo cada uma leva.",
  "“I'd prefer…” is a natural way to say which option you want. “I still need…” explains why.": "“I'd prefer…” é uma forma natural de dizer qual opção você deseja. “I still need…” explica o motivo.",
  "“Would be better for me” is a polite way to express a preference.": "“Would be better for me” é uma forma educada de expressar uma preferência.",
  "When you need more information, “Could you tell me…?” keeps the conversation polite.": "Quando precisar de mais informações, “Could you tell me…?” mantém a conversa educada.",
  "You can ask for what you need, choose an option or request more information. Each is a useful real-life strategy.": "Você pode pedir o que precisa, escolher uma opção ou solicitar mais informações. Todas são estratégias úteis para situações reais.",
  "A small complication": "Uma pequena complicação",
  "There is one more detail. The music afternoon is on Saturday, and today is Thursday. The shop says a replacement usually takes two to four working days. What would you like to ask?": "Há mais um detalhe. A tarde musical será no sábado e hoje é quinta-feira. A loja informa que uma substituição normalmente leva de dois a quatro dias úteis. O que você gostaria de perguntar?",
  "“Is there any chance it could arrive by Saturday?”": "“Existe alguma possibilidade de chegar até sábado?”",
  "“Could you confirm the delivery date before I decide?”": "“Você poderia confirmar a data de entrega antes de eu decidir?”",
  "“That's fine. I can wait a few more days.”": "“Tudo bem. Posso esperar mais alguns dias.”",
  "The agent checks express delivery. “We can try, but I can't promise it.”": "O atendente verifica a opção de entrega expressa. “Podemos tentar, mas não posso garantir.”",
  "The agent checks the delivery options and gives you a clearer estimate before you make your decision.": "O atendente verifica as opções de entrega e fornece uma previsão mais clara antes de você tomar sua decisão.",
  "The agent appreciates your flexibility and confirms the standard delivery window.": "O atendente agradece sua flexibilidade e confirma o prazo normal de entrega.",
  "“Is there any chance…?” is a tactful way to ask about a possibility.": "“Is there any chance…?” é uma maneira cuidadosa de perguntar sobre uma possibilidade.",
  "“Could you confirm…?” asks for specific information before you choose.": "“Could you confirm…?” solicita uma informação específica antes de você escolher.",
  "“I can wait” communicates that the proposed time is acceptable.": "“I can wait” comunica que o prazo proposto é aceitável.",
  "A good conversation includes checking dates and expectations, not only choosing a product.": "Uma boa conversa inclui confirmar datas e expectativas, não apenas escolher um produto.",
  "The final confirmation": "A confirmação final",
  "The agent is ready to close the request. Before ending the conversation, you want to make sure the next step is clear. What do you say?": "O atendente está pronto para concluir a solicitação. Antes de encerrar a conversa, você quer ter certeza de que a próxima etapa está clara. O que você diz?",
  "“Thank you. Could you email me the confirmation, please?”": "“Obrigado. Você poderia me enviar a confirmação por e-mail, por favor?”",
  "“So, what happens next?”": "“Então, o que acontece agora?”",
  "“Thanks for your help. Have a good day!”": "“Obrigado pela ajuda. Tenha um bom dia!”",
  "“Of course. You'll receive an email with the details shortly,” the agent replies.": "“Claro. Você receberá um e-mail com os detalhes em breve”, responde o atendente.",
  "The agent summarises the next step and tells you when to expect an update.": "O atendente resume a próxima etapa e informa quando você pode esperar uma atualização.",
  "The agent thanks you too. The conversation ends on a friendly note.": "O atendente também agradece. A conversa termina de maneira cordial.",
  "Ask for written confirmation so you can check the details later.": "Peça uma confirmação por escrito para poder consultar os detalhes depois.",
  "This is a simple, natural question when you need the next step explained.": "Esta é uma pergunta simples e natural quando você precisa que expliquem a próxima etapa.",
  "A polite closing helps keep customer conversations positive.": "Um encerramento educado ajuda a manter positivas as conversas com clientes.",
  "Before you finish, check that you know what will happen next and when.": "Antes de terminar, confirme se você sabe o que acontecerá em seguida e quando."
};

const outcomeText: Record<string, string> = {
  replacement: "The shop arranged a replacement speaker. You received the confirmation and can follow the delivery.",
  refund: "The shop processed your refund. You have the confirmation and can choose another speaker later.",
  "more-info": "You asked the right questions and got the information you needed to make a confident decision.",
  "follow-up": "You kept the order details and agreed on how to follow up. You know what to check next.",
  polite: "You handled the conversation calmly, explained the situation and agreed on a clear next step.",
};

export function A2SurpriseDelivery() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const translated = (text: string) => portugueseTranslations[text];
  const [lastConsequence, setLastConsequence] = useState<Choice["consequence"]>("polite");
  const [completed, setCompleted] = useState(false);
  const [decisions, setDecisions] = useState<string[]>([]);
  const { markCompleted, markActivityCompleted } = useEnglishAdventuresProgress();
  useAdventureActivityTimer(completed ? null : "a2-surprise-delivery:" + index);
  const scene = scenes[index];
  if (!scene) return null;
  const choice = selected === null ? null : scene.choices[selected];

  function continueStory() {
    if (!choice) return;
    setLastConsequence(choice.consequence);
    setDecisions((items) => [...items, choice.consequence]);
    markActivityCompleted("a2-surprise-delivery:" + index);
    if (index === scenes.length - 1) {
      setCompleted(true);
      markCompleted("a2-surprise-delivery");
    } else {
      setIndex((value) => value + 1);
      setSelected(null);
      setShowTranslation(false);
    }
  }

  function restart() {
    setIndex(0);
    setSelected(null);
    setShowTranslation(false);
    setLastConsequence("polite");
    setCompleted(false);
    setDecisions([]);
  }

  const finalOutcome = decisions.includes("replacement")
    ? "replacement"
    : decisions.includes("refund")
      ? "refund"
      : decisions.includes("more-info")
        ? "more-info"
        : decisions.includes("follow-up")
          ? "follow-up"
          : lastConsequence;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> {t("Back to home")}
        </Link>
        <header className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:flex sm:gap-4">
          <EnglishAdventuresAvatar className="size-16 shrink-0 sm:size-20" />
          <div className="min-w-0 sm:flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-green">
              <Compass className="size-3.5 shrink-0" aria-hidden="true" /> {t("English Adventures")} · A2 · 01
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl" translate="no" lang="en">The Surprise Delivery</h1>
            <p className="text-sm text-muted-foreground">{t("An adventure about deliveries, problems and finding a solution.")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("An adventure to practise describing problems, making polite requests and choosing solutions.")}</p>
          </div>
          <div className="col-span-2 row-start-2 w-full min-w-0 sm:absolute sm:right-0 sm:top-[-3.5rem] sm:col-auto sm:row-auto sm:w-auto">
            <AdventureMusicControl welcomeVoice="arabella" />
          </div>
        </header>
        <EnglishAdventureJourneyMap adventureId="a2-surprise-delivery" activityIndex={index} isComplete={completed} />


        {!completed ? (
          <section className="card-soft space-y-4 p-4 sm:p-6" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-green" translate="no" lang="en">{scene.place}</span>
              <span className="text-xs text-muted-foreground">{index + 1} / {scenes.length}</span>
            </div>
            <p className="text-base leading-relaxed sm:text-lg" translate="no" lang="en">{scene.story}</p>
            <button type="button" onClick={() => setShowTranslation((value) => !value)} aria-expanded={showTranslation} className="inline-flex items-center rounded-lg py-1 text-sm font-medium text-brand-green underline-offset-4 hover:underline">
              {showTranslation ? "Ocultar tradução" : "Ver tradução"}
            </button>
            {showTranslation && <p className="rounded-lg bg-secondary/60 p-3 text-sm leading-relaxed text-muted-foreground" lang="pt">{translated(scene.story)}</p>}
            <p className="text-sm font-semibold">{t("What would you say?")}</p>
            <div className="grid gap-2">
              {scene.choices.map((option, optionIndex) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setSelected(optionIndex)}
                  aria-pressed={selected === optionIndex}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 ${selected === optionIndex ? "border-brand-green bg-brand-green/10" : "border-border hover:border-brand-green/50 hover:bg-secondary/50"}`}
                >
                  <span className="block font-medium" translate="no" lang="en">{option.label}</span>
                  {showTranslation && <span className="mt-1 block text-xs text-muted-foreground" lang="pt">{translated(option.label)}</span>}
                </button>
              ))}
            </div>
            {choice && (
              <div className="rounded-xl bg-brand-green/10 p-3">
                <p className="text-sm leading-relaxed" translate="no" lang="en">{choice.response}</p>
                {showTranslation && <p className="mt-1 text-sm text-muted-foreground" lang="pt">{translated(choice.response)}</p>}
                <p className="mt-2 text-sm text-muted-foreground" translate="no" lang="en">{choice.coaching}</p>
                {showTranslation && <p className="mt-1 text-sm text-muted-foreground" lang="pt">{translated(choice.coaching)}</p>}
                <div className="mt-3 flex items-start gap-2 border-t border-brand-green/20 pt-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden="true" />
                  <div><p className="text-sm text-muted-foreground" translate="no" lang="en">{scene.evo}</p>
                  {showTranslation && <p className="mt-1 text-sm text-muted-foreground" lang="pt">{translated(scene.evo)}</p>}</div>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={continueStory} disabled={selected === null}>
                {index === scenes.length - 1 ? t("Finish adventure") : t("Continue the story")}
                <ArrowRight className="ml-1 size-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        ) : (
          <section className="card-soft space-y-4 p-5 text-center sm:p-8">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-green/10 text-brand-green">
              <Sparkles className="size-7" aria-hidden="true" />
            </span>
            <h2 className="font-display text-xl font-semibold">{t("Adventure complete!")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground" translate="no" lang="en">{outcomeText[finalOutcome]}</p>
            <p className="text-sm text-muted-foreground">{t("You practised describing a problem, making polite requests, comparing options and confirming next steps.")}</p>
            <p className="text-sm font-medium">{t("Your choices shaped the conversation. There is more than one way to find a good solution.")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={restart}><RotateCcw className="mr-1 size-4" />{t("Explore again")}</Button>
              <Button asChild><Link to="/adventures" search={{ story: "a2-2" }}>{t("Next adventure · A2.2")}</Link></Button>
              <Button asChild variant="outline"><Link to="/dashboard">{t("Back to home")}</Link></Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

/* eslint-disable prettier/prettier */
import { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { AdventureMusicControl } from "@/components/adventures/AdventureMusicControl";
import { EnglishAdventuresAvatar } from "@/components/EnglishAdventuresAvatar";
import { Button } from "@/components/ui/button";
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
];

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
  const [lastConsequence, setLastConsequence] = useState<Choice["consequence"]>("polite");
  const [completed, setCompleted] = useState(false);
  const [decisions, setDecisions] = useState<string[]>([]);
  const scene = scenes[index];
  if (!scene) return null;
  const choice = selected === null ? null : scene.choices[selected];

  function continueStory() {
    if (!choice) return;
    setLastConsequence(choice.consequence);
    setDecisions((items) => [...items, choice.consequence]);
    if (index === scenes.length - 1) setCompleted(true);
    else {
      setIndex((value) => value + 1);
      setSelected(null);
    }
  }

  function restart() {
    setIndex(0);
    setSelected(null);
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

        {!completed ? (
          <section className="card-soft space-y-4 p-4 sm:p-6" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-green" translate="no" lang="en">{scene.place}</span>
              <span className="text-xs text-muted-foreground">{index + 1} / {scenes.length}</span>
            </div>
            <p className="text-base leading-relaxed sm:text-lg" translate="no" lang="en">{scene.story}</p>
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
                  <span className="font-medium" translate="no" lang="en">{option.label}</span>
                </button>
              ))}
            </div>
            {choice && (
              <div className="rounded-xl bg-brand-green/10 p-3">
                <p className="text-sm leading-relaxed" translate="no" lang="en">{choice.response}</p>
                <p className="mt-2 text-sm text-muted-foreground" translate="no" lang="en">{choice.coaching}</p>
                <div className="mt-3 flex items-start gap-2 border-t border-brand-green/20 pt-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground" translate="no" lang="en">{scene.evo}</p>
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
              <Button asChild variant="outline"><Link to="/dashboard">{t("Back to home")}</Link></Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

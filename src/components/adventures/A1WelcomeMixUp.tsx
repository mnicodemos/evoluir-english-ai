import { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type Choice = {
  label: string;
  response: string;
  correct: boolean;
  hint: string;
};

type Scene = {
  place: string;
  story: string;
  choices: Choice[];
  evo: string;
};

const adventureTitle = "The Welcome Mix-Up";
const completionText =
  "You completed 10 challenges, checked the guests’ details and helped Maya join the festival.";

const scenes: Scene[] = [
  {
    place: "The welcome desk",
    story:
      "It is the first day of the International Friends Festival. You are helping EVO welcome three new guests: Ana from Brazil, Leo from Italy and Maya from Canada. Their name cards are mixed up. One guest says: “I am Maya. I am from Canada, and I am a photographer.” Can you help?",
    choices: [
      {
        label: "“Could you spell your name, please?”",
        response: "“M-A-Y-A,” she says. You now have a useful clue: the guest's name is Maya.",
        correct: true,
        hint: "A name is a strong first clue. Ask the guest to spell it.",
      },
      {
        label: "“You are Ana, right?”",
        response: "“No, I'm Maya,” she replies kindly. The names are still mixed up.",
        correct: false,
        hint: "Don't guess the name. Ask the person to spell it so you can check the card.",
      },
      {
        label: "“Where is the café?”",
        response: "EVO smiles, but the name cards are still mixed up.",
        correct: false,
        hint: "The task is to identify the guest. Ask a question about the name first.",
      },
    ],
    evo: "Nice! “Could you spell your name?” is a polite way to check a name. Listen for each letter.",
  },
  {
    place: "The country clue",
    story:
      "Maya's name is clear now. Two cards are left: “Ana — Italy — student” and “Leo — Brazil — designer”. The guests tell you the country and job on their cards are wrong. What should you check next?",
    choices: [
      {
        label: "“Are you from Canada?”",
        response:
          "“Yes, I am. I'm from Canada,” Maya confirms. You can now match her name and country.",
        correct: true,
        hint: "Use the country Maya already told you. Check it with a short question.",
      },
      {
        label: "“Are you a doctor?”",
        response: "“No, I'm a photographer,” Maya says. The job clue does not match the card yet.",
        correct: false,
        hint: "Maya already gave you two clues: Canada and photographer. Check the country first.",
      },
      {
        label: "“Is this your phone?”",
        response: "Maya looks at the cards. “Let's finish the name cards first!”",
        correct: false,
        hint: "Stay with the information on the cards: country and job.",
      },
    ],
    evo: "Good checking! Use “Are you from…?” for a country and “Are you a…?” for a job.",
  },
  {
    place: "The matching table",
    story:
      "You have Maya's name and country. Her card says “Maya — Canada — photographer”. Which card should you give her?",
    choices: [
      {
        label: "Maya — Canada — photographer",
        response: "“That's me!” Maya smiles and takes the correct card. One guest is ready!",
        correct: true,
        hint: "Match all three pieces of information: name, country and job.",
      },
      {
        label: "Ana — Italy — student",
        response: "Maya shakes her head. “That's not my name or my country.”",
        correct: false,
        hint: "Look for Maya, Canada and photographer together. Check every detail.",
      },
      {
        label: "Leo — Brazil — designer",
        response: "“That card belongs to someone else,” Maya says.",
        correct: false,
        hint: "The correct card must match the guest's name, country and job.",
      },
    ],
    evo: "You compared three details instead of guessing. That is how you solve a mix-up accurately.",
  },
  {
    place: "A second name check",
    story:
      "Before the festival opens, Ana asks for her card. You want to make sure you have the right person. She says: “My name is Ana.” What is the best way to confirm the spelling?",
    choices: [
      {
        label: "“How do you spell Ana?”",
        response: "Ana spells it: “A-N-A.” You can check the letters on her card.",
        correct: true,
        hint: "Use “How do you spell…?” when you need to check the letters in a name.",
      },
      {
        label: "“Where are you?”",
        response: "“I'm here at the welcome desk,” Ana replies. You still need to check her name.",
        correct: false,
        hint: "Ask about the spelling of the name, not the person's location.",
      },
      {
        label: "“Are you a name?”",
        response: "Ana smiles, but she does not understand the question.",
        correct: false,
        hint: "Use a simple question with “spell” to check the letters.",
      },
    ],
    evo: "A useful question: “How do you spell your name?” It helps you write names correctly.",
  },
  {
    place: "Where is Ana from?",
    story:
      "Ana's name is clear. She says: “I'm from Brazil.” You want to confirm the country before choosing her card. What do you ask?",
    choices: [
      {
        label: "“Are you from Brazil?”",
        response: "“Yes, I am. I'm from Brazil,” Ana confirms.",
        correct: true,
        hint: "For a country, use “Are you from…?”",
      },
      {
        label: "“Is you from Brazil?”",
        response: "Ana understands, but the question needs the correct form of “to be”.",
        correct: false,
        hint: "With “you”, use “are”: “Are you from Brazil?”",
      },
      {
        label: "“Do you Brazil?”",
        response: "Ana asks you to try the question again.",
        correct: false,
        hint: "Use “be from” to talk about someone's country.",
      },
    ],
    evo: "Remember: I am, you are, he is, she is. The verb changes with the subject.",
  },
  {
    place: "The job clue",
    story:
      "Leo arrives at the desk. He says: “I'm from Italy. I'm a designer.” Which question checks his profession?",
    choices: [
      {
        label: "“Are you a designer?”",
        response: "“Yes, I am. I'm a designer,” Leo answers.",
        correct: true,
        hint: "For a job, use “Are you a…?” before the profession.",
      },
      {
        label: "“Are you from a designer?”",
        response: "Leo looks puzzled. A profession is not a country.",
        correct: false,
        hint: "Ask “Are you a…?” when checking a job.",
      },
      {
        label: "“Do you a designer?”",
        response: "Leo asks you to try that question again.",
        correct: false,
        hint: "Use the verb “to be” before a profession: “Are you a designer?”",
      },
    ],
    evo: "Great investigation! Use “from” for a country and “a/an” before a singular job.",
  },
  {
    place: "The grammar checkpoint",
    story:
      "EVO finds a note with three introductions. One sentence is correct. Choose the sentence with the right form of “to be”.",
    choices: [
      {
        label: "“Maya is a photographer.”",
        response: "Correct! “Maya” is she, so we use “is”.",
        correct: true,
        hint: "For he, she or it, use “is”.",
      },
      {
        label: "“Maya are a photographer.”",
        response: "The subject is one person: Maya. Check the verb form.",
        correct: false,
        hint: "Use “is” with he, she or a person's name.",
      },
      {
        label: "“Maya am a photographer.”",
        response: "“Am” belongs with “I”, not with Maya.",
        correct: false,
        hint: "Use “am” with I; use “is” with Maya.",
      },
    ],
    evo: "A quick grammar reminder: I am, you are, he is, she is. You are getting better at introductions!",
  },
  {
    place: "Three guests, three cards",
    story:
      "Now you have all the clues. Match each guest to the correct information: Ana is from Brazil and is a student; Leo is from Italy and is a designer; Maya is from Canada and is a photographer. Which set is correct?",
    choices: [
      {
        label: "Ana — Brazil — student; Leo — Italy — designer",
        response: "The first two cards match the guests. Maya's card is already ready!",
        correct: true,
        hint: "Check each name, country and job as a group. This choice matches Ana and Leo.",
      },
      {
        label: "Ana — Italy — designer; Leo — Brazil — student",
        response:
          "Those details belong to the other guest. Compare the country and job clues again.",
        correct: false,
        hint: "Ana told you Brazil and student. Leo told you Italy and designer.",
      },
      {
        label: "Ana — Canada — photographer; Leo — Brazil — student",
        response: "You have mixed details from different guests. Look at each introduction again.",
        correct: false,
        hint: "Keep Maya's Canada/photographer clues separate from Ana and Leo.",
      },
    ],
    evo: "You are checking more than one detail at a time. That is an important real-life reading skill.",
  },
  {
    place: "The welcome board",
    story:
      "The cards are ready. The festival team asks you to complete the welcome board with a short introduction for Leo. Which sentence is correct and friendly?",
    choices: [
      {
        label: "“This is Leo. He is from Italy. He is a designer.”",
        response: "The welcome board is clear and correct. Leo is happy to see his introduction!",
        correct: true,
        hint: "Use “he” for Leo and “is” to give his country and job.",
      },
      {
        label: "“This are Leo. He am from Italy.”",
        response: "The words do not agree. Try the sentence again with “this is” and “he is”.",
        correct: false,
        hint: "Use “This is Leo” and “He is from Italy.”",
      },
      {
        label: "“She is Leo. He are from Italy.”",
        response: "The pronoun and verb do not match Leo. Check both parts.",
        correct: false,
        hint: "Leo is “he”. With “he”, use “is”.",
      },
    ],
    evo: "Pronouns help us avoid repeating names: he for Leo, she for Maya and Ana.",
  },
  {
    place: "Welcome to the festival",
    story:
      "Maya has her card. Ana and Leo are waiting, and the festival is about to begin. Maya introduces herself: “Hi, I'm Maya. I'm from Canada. I'm a photographer.” What is a friendly reply?",
    choices: [
      {
        label: "“Nice to meet you, Maya!”",
        response:
          "“Nice to meet you too!” Maya joins the festival. The welcome desk is back on track.",
        correct: true,
        hint: "A friendly first meeting often ends with “Nice to meet you”.",
      },
      {
        label: "“Good night, goodbye!”",
        response: "Maya looks surprised. The festival is just starting!",
        correct: false,
        hint: "It is the start of the event. Choose a greeting for meeting someone, not saying goodbye.",
      },
      {
        label: "“I am from Canada too”",
        response: "Maya waits for you to continue. You can welcome her with a simple expression.",
        correct: false,
        hint: "You do not need to say where you are from. Welcome Maya politely.",
      },
    ],
    evo: "You used names, countries, jobs, “to be” and a friendly introduction. You helped everyone feel welcome!",
  },
];

export function A1WelcomeMixUp() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [recovered, setRecovered] = useState(0);
  const scene = scenes[sceneIndex] ?? scenes[0];
  if (!scene) return null;
  const choice = selected === null ? null : scene.choices[selected];
  const canContinue = choice?.correct === true;

  function continueStory() {
    if (!canContinue) return;
    if (sceneIndex === scenes.length - 1) setCompleted(true);
    else {
      setSceneIndex((value) => value + 1);
      setSelected(null);
    }
  }

  function restart() {
    setSceneIndex(0);
    setSelected(null);
    setCompleted(false);
    setRecovered(0);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("Back to home")}
        </Link>
        <header className="flex items-center gap-4">
          <EvoAvatar className="size-16 sm:size-20" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-green">
              <Compass className="size-3.5" aria-hidden="true" />
              {t("English Adventures")} · A1
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl" translate="no" lang="en">
              {adventureTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{t("A1 adventure introduction")}</p>
          </div>
        </header>

        {!completed ? (
          <section className="card-soft space-y-4 p-4 sm:p-6" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-xs font-semibold uppercase tracking-wider text-brand-green"
                translate="no"
                lang="en"
              >
                {scene.place}
              </span>
              <span className="text-xs text-muted-foreground">
                {sceneIndex + 1} / {scenes.length}
              </span>
            </div>
            <p className="text-base leading-relaxed sm:text-lg" translate="no" lang="en">
              {scene.story}
            </p>
            <p className="text-sm font-semibold">{t("Choose your response")}</p>
            <div className="grid gap-2">
              {scene.choices.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    if (selected !== null && !scene.choices[selected]?.correct && option.correct) {
                      setRecovered((value) => value + 1);
                    }
                    setSelected(index);
                  }}
                  aria-pressed={selected === index}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 ${
                    selected === index
                      ? option.correct
                        ? "border-brand-green bg-brand-green/10"
                        : "border-warning bg-warning/10"
                      : "border-border hover:border-brand-green/50 hover:bg-secondary/50"
                  }`}
                >
                  <span className="font-medium" translate="no" lang="en">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
            {choice && (
              <div className="rounded-xl bg-brand-green/10 p-3">
                <p className="text-sm leading-relaxed" translate="no" lang="en">
                  {choice.response}
                </p>
                {!choice.correct && (
                  <p className="mt-2 text-sm text-muted-foreground" translate="no" lang="en">
                    {t("EVO hint label")} {choice.hint}
                  </p>
                )}
                <div className="mt-3 flex items-start gap-2 border-t border-brand-green/20 pt-3">
                  <Sparkles
                    className="mt-0.5 size-4 shrink-0 text-brand-green"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground" translate="no" lang="en">
                    {scene.evo}
                  </p>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={continueStory} disabled={!canContinue}>
                {sceneIndex === scenes.length - 1 ? t("Finish adventure") : t("Continue the story")}
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
            <p className="text-sm leading-relaxed text-muted-foreground" translate="no" lang="en">
              {completionText}
            </p>
            <p className="text-sm font-medium">{t("A1 adventure learning recap")}</p>
            <p className="text-sm text-muted-foreground">
              {t("A1 adventure recovery recap").replace("{count}", String(recovered))}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={restart}>
                <RotateCcw className="mr-1 size-4" />
                {t("Explore again")}
              </Button>
              <Button asChild variant="outline">
                <Link to="/adventures" search={{ story: "neighbourhood-mystery" }}>
                  {t("Next adventure · A1.2")}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/dashboard">{t("Back to home")}</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

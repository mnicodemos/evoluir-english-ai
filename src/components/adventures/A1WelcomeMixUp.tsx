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
const completionText = "You solved the welcome mix-up and helped Maya join the festival.";

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
                <Link to="/dashboard">{t("Back to home")}</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

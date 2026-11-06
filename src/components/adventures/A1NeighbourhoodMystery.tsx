/* eslint-disable prettier/prettier */
import { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type Challenge = {
  place: string;
  story: string;
  choices: { label: string; response: string; correct: boolean; hint: string }[];
  evo: string;
};

const challenges: Challenge[] = [
  {
    place: "A note on the street",
    story: "You are walking through Maple Street with EVO. You find a small red key next to a house. A note says: “I lost my key. It is small and red.” What should you do first?",
    choices: [
      { label: "Look for the person who lost it", response: "Good idea. Someone nearby may be looking for the key.", correct: true, hint: "Start by finding the owner. The note tells you someone is looking for the key." },
      { label: "Put it in your bag", response: "That does not help the owner find the key.", correct: false, hint: "Think about the person who lost the key. How can you help them?" },
      { label: "Throw it away", response: "The key may be important to someone.", correct: false, hint: "Keep the key safe while you investigate." },
    ],
    evo: "A mystery begins with a clue. Read carefully before you decide what to do.",
  },
  {
    place: "The first clue",
    story: "A neighbour is outside. She says: “I have a red door and a small garden.” You see three houses. Which house matches her description?",
    choices: [
      { label: "The house with a red door and a small garden", response: "That is the house in her description.", correct: true, hint: "Match both details: the door and the garden." },
      { label: "The house with a blue door and a big garden", response: "The colour and garden size are different.", correct: false, hint: "She said red door and small garden." },
      { label: "The house with a white door and no garden", response: "This house does not match the clues.", correct: false, hint: "Look for the red door and the small garden." },
    ],
    evo: "Descriptions help us identify places. Notice adjectives such as red, small, blue and big.",
  },
  {
    place: "Who lives here?",
    story: "At the red-door house, you meet Ben. He says: “I have a sister. Her name is Lucy.” Who has a sister named Lucy?",
    choices: [
      { label: "Ben has a sister named Lucy.", response: "Exactly. Ben is the person who gave you the clue.", correct: true, hint: "Use “has” with he, she or a person's name." },
      { label: "Lucy have a sister named Ben.", response: "The information is reversed, and the verb form is incorrect.", correct: false, hint: "Ben says “I have a sister”. When you use Ben, say “Ben has…”." },
      { label: "The house has a sister named Lucy.", response: "A house cannot have a sister. Look for the person.", correct: false, hint: "The clue is about Ben and his family." },
    ],
    evo: "Remember: I/you/we/they have; he/she/it has.",
  },
  {
    place: "A family photograph",
    story: "Ben shows you a photograph. “This is my sister. She has a yellow bicycle.” What are you looking for?",
    choices: [
      { label: "A yellow bicycle", response: "Yes. Lucy's bicycle is yellow.", correct: true, hint: "Find the object and its colour in Ben's sentence." },
      { label: "A red car", response: "There is no red car in the clue.", correct: false, hint: "Ben said his sister has a bicycle. Check its colour." },
      { label: "A blue backpack", response: "The backpack is not part of this clue.", correct: false, hint: "Look for the bicycle, not another object." },
    ],
    evo: "“She has” tells us what belongs to Lucy. The adjective “yellow” describes the bicycle.",
  },
  {
    place: "Near the playground",
    story: "You find a yellow bicycle near the playground. There is a small basket on the bicycle. Where is the basket?",
    choices: [
      { label: "On the bicycle", response: "Correct. The basket is on the bicycle.", correct: true, hint: "Use “on” when something is attached to or resting on a surface." },
      { label: "Under the bicycle", response: "Look again. The basket is attached above the wheels.", correct: false, hint: "The clue says the basket is on the bicycle." },
      { label: "In the house", response: "The basket is with the bicycle outside.", correct: false, hint: "The bicycle is near the playground. Check its position." },
    ],
    evo: "Prepositions show where things are: on, in, under and next to.",
  },
  {
    place: "A message from Lucy",
    story: "A child comes to the playground. “I'm Lucy. My bicycle has a basket. Is it here?” What is the best reply?",
    choices: [
      { label: "“Yes, it is next to the playground.”", response: "Lucy smiles. “That's my bicycle. Thank you!”", correct: true, hint: "Answer her question and use a place expression." },
      { label: "“Yes, they are a bicycle.”", response: "The pronoun and verb do not match the singular bicycle.", correct: false, hint: "For “it”, use “is”: “Yes, it is…”." },
      { label: "“No, I have a sister.”", response: "That does not answer Lucy's question.", correct: false, hint: "She is asking about her bicycle. Give information about its location." },
    ],
    evo: "A clear answer connects the object with its location: “It is next to…”",
  },
  {
    place: "The key's owner",
    story: "Lucy says: “Ben is my brother. We live in the red house.” You remember the red key. Who should you ask about the key?",
    choices: [
      { label: "Ben and Lucy", response: "Good thinking. They live in the house described in the first clue.", correct: true, hint: "Connect the family clue with the red-door house." },
      { label: "A family in the blue house", response: "The blue house did not match the first description.", correct: false, hint: "Lucy said she and Ben live in the red house." },
      { label: "The playground teacher", response: "There is no clue connecting the teacher to the key.", correct: false, hint: "Use the information you have collected about the neighbours." },
    ],
    evo: "You are connecting clues from different moments. Good investigators remember details.",
  },
  {
    place: "The right article",
    story: "Ben looks at the key and says: “It is ___ small key.” Choose the correct word.",
    choices: [
      { label: "a", response: "Correct: “It is a small key.”", correct: true, hint: "Use “a” before a singular countable noun that begins with a consonant sound." },
      { label: "an", response: "“Key” begins with a consonant sound, so “an” is not correct here.", correct: false, hint: "Use “a” before the consonant sound in “key”." },
      { label: "the", response: "“The” points to a specific key already identified. Here you are introducing it.", correct: false, hint: "You are describing it for the first time: “a small key”." },
    ],
    evo: "Use a/an when introducing one thing: a key, an apple. Use the when it is specific.",
  },
  {
    place: "The final check",
    story: "Ben checks his pocket. “My key is not here. Lucy has her own key.” Which sentence is true?",
    choices: [
      { label: "“Ben does not have the key. Lucy has her own key.”", response: "That matches what Ben told you.", correct: true, hint: "Read both parts: Ben's key is missing, and Lucy has her own." },
      { label: "“Ben have the key and Lucy have no key.”", response: "This changes the information and uses the wrong verb forms.", correct: false, hint: "Ben says his key is not here. Lucy has her own key." },
      { label: "“The key is inside the bicycle.”", response: "Nobody said the key was inside the bicycle.", correct: false, hint: "Do not add information. Use only the clues you know." },
    ],
    evo: "Separate what you know from what you guess. Accurate reading is part of solving a mystery.",
  },
  {
    place: "Mystery solved",
    story: "Lucy finds a small red key in the pocket of her jacket. It belongs to Ben! You helped the neighbours, found the bicycle and checked every clue. What can you say?",
    choices: [
      { label: "“We found the key! It is yours, Ben.”", response: "Ben smiles. “Thank you! You solved the mystery.”", correct: true, hint: "Use “we” because you worked together, and “yours” for something that belongs to Ben." },
      { label: "“We finds the keys.”", response: "Check the verb after “we” and the number of objects.", correct: false, hint: "Use “find” with we: “We found the key.”" },
      { label: "“The key are yours.”", response: "“Key” is singular, so the verb must also be singular.", correct: false, hint: "Say “The key is yours.”" },
    ],
    evo: "You used descriptions, family words, have/has, articles and prepositions to solve the neighbourhood mystery!",
  },
];

export function A1NeighbourhoodMystery() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [recovered, setRecovered] = useState(0);
  const [complete, setComplete] = useState(false);
  const challenge = challenges[index];
  if (!challenge) return null;
  const choice = selected === null ? null : challenge.choices[selected];
  const canContinue = choice?.correct === true;

  function continueStory() {
    if (!canContinue) return;
    if (index === challenges.length - 1) setComplete(true);
    else {
      setIndex((value) => value + 1);
      setSelected(null);
    }
  }

  function restart() {
    setIndex(0);
    setSelected(null);
    setRecovered(0);
    setComplete(false);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> {t("Back to home")}
        </Link>
        <header className="flex items-center gap-4">
          <EvoAvatar className="size-16 sm:size-20" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-green">
              <Compass className="size-3.5" aria-hidden="true" /> {t("English Adventures")} · A1 · 02
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("The Neighbourhood Mystery")}</h1>
            <p className="text-sm text-muted-foreground">{t("A1 adventure introduction")}</p>
          </div>
        </header>
        {!complete ? (
          <section className="card-soft space-y-4 p-4 sm:p-6" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-green" translate="no" lang="en">{challenge.place}</span>
              <span className="text-xs text-muted-foreground">{index + 1} / {challenges.length}</span>
            </div>
            <p className="text-base leading-relaxed sm:text-lg" translate="no" lang="en">{challenge.story}</p>
            <p className="text-sm font-semibold">{t("Choose your response")}</p>
            <div className="grid gap-2">
              {challenge.choices.map((option, optionIndex) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    if (selected !== null && !challenge.choices[selected]?.correct && option.correct) {
                      setRecovered((value) => value + 1);
                    }
                    setSelected(optionIndex);
                  }}
                  aria-pressed={selected === optionIndex}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 ${
                    selected === optionIndex
                      ? option.correct
                        ? "border-brand-green bg-brand-green/10"
                        : "border-warning bg-warning/10"
                      : "border-border hover:border-brand-green/50 hover:bg-secondary/50"
                  }`}
                >
                  <span className="font-medium" translate="no" lang="en">{option.label}</span>
                </button>
              ))}
            </div>
            {choice && (
              <div className="rounded-xl bg-brand-green/10 p-3">
                <p className="text-sm leading-relaxed" translate="no" lang="en">{choice.response}</p>
                {!choice.correct && <p className="mt-2 text-sm text-muted-foreground" translate="no" lang="en">{t("EVO hint label")} {choice.hint}</p>}
                <div className="mt-3 flex items-start gap-2 border-t border-brand-green/20 pt-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground" translate="no" lang="en">{challenge.evo}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={continueStory} disabled={!canContinue}>
                {index === challenges.length - 1 ? t("Finish adventure") : t("Continue the story")}
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
            <p className="text-sm leading-relaxed text-muted-foreground">{t("You completed 10 challenges and helped Ben and Lucy solve the neighbourhood mystery.")}</p>
            <p className="text-sm font-medium"> {t("A1 adventure learning recap")}</p>
            <p className="text-sm text-muted-foreground">{t("A1 adventure recovery recap").replace("{count}", String(recovered))}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={restart}><RotateCcw className="mr-1 size-4" />{t("Explore again")}</Button>
              <Button asChild variant="outline"><Link to="/adventures" search={{ story: "clock-tower-mission" }}>{t("Next adventure · A1.3")}</Link></Button>
              <Button asChild variant="ghost"><Link to="/dashboard">{t("Back to home")}</Link></Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

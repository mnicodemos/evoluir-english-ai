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
    place: "A strange morning",
    story: "You arrive in the town square with EVO. The clock tower is stopped, and the town festival starts today. The mayor says: “The clock stopped at seven o'clock. We need to check the time before the festival begins.” What should you do first?",
    choices: [
      { label: "Check the town schedule", response: "Good plan. The schedule can tell you when the important events start.", correct: true, hint: "You need information about the times of today's events." },
      { label: "Close the festival", response: "The festival can still happen. First, find out what time it is.", correct: false, hint: "Look for a source of information about today's schedule." },
      { label: "Move the clock hands at random", response: "That may show the wrong time. You need a clue first.", correct: false, hint: "Check the schedule before changing the clock." },
    ],
    evo: "A good mission starts with a plan. Look for useful information before you act.",
  },
  {
    place: "The morning schedule",
    story: "The schedule says: “The market opens at eight o'clock. The music starts at ten o'clock.” What time does the market open?",
    choices: [
      { label: "At eight o'clock", response: "Exactly. The market opens at eight.", correct: true, hint: "Find the event called “the market” and read its time." },
      { label: "At ten o'clock", response: "That is the time for the music, not the market.", correct: false, hint: "The schedule gives a different time for each event." },
      { label: "At seven o'clock", response: "Seven o'clock is when the clock stopped.", correct: false, hint: "The market opens one hour after seven." },
    ],
    evo: "We use “at” with clock times: at eight o'clock, at ten thirty.",
  },
  {
    place: "A message from the baker",
    story: "The baker sends a message: “I get up at six. I make bread in the morning. I open my shop at eight.” Which sentence is true?",
    choices: [
      { label: "The baker opens the shop at eight.", response: "Correct. That is the time in the message.", correct: true, hint: "Look for the verb “open” in the baker's message." },
      { label: "The baker gets up at eight.", response: "The baker gets up at six, not eight.", correct: false, hint: "Separate the time for getting up from the time for opening the shop." },
      { label: "The baker makes bread at night.", response: "The message says the baker makes bread in the morning.", correct: false, hint: "Check the part of the day in the second sentence." },
    ],
    evo: "Present simple describes routines: “I get up”, “I make bread”, “I open my shop”.",
  },
  {
    place: "The right routine",
    story: "EVO finds three notes about the festival helpers. Choose the sentence with the correct present simple form.",
    choices: [
      { label: "“She starts work at nine.”", response: "Exactly. With she, we usually add -s to the verb.", correct: true, hint: "For he, she and it, remember the -s ending in the present simple." },
      { label: "“She start work at nine.”", response: "The sentence needs the third-person verb ending.", correct: false, hint: "Say “She starts”, not “She start”." },
      { label: "“She starting work at nine.”", response: "This is not the present simple form used for a routine.", correct: false, hint: "Use the base verb plus -s for she: “starts”." },
    ],
    evo: "Remember: I work, you work, but he/she works. Small endings carry important information.",
  },
  {
    place: "The missing day",
    story: "The festival plan says: “The food market is on Friday. The parade is on Saturday. The music show is on Sunday.” When is the parade?",
    choices: [
      { label: "On Saturday", response: "Correct. The parade is on Saturday.", correct: true, hint: "Find the word “parade” and read the day next to it." },
      { label: "On Friday", response: "Friday is the day for the food market.", correct: false, hint: "Each activity has its own day in the plan." },
      { label: "On Sunday", response: "Sunday is the day for the music show.", correct: false, hint: "Look again at the line about the parade." },
    ],
    evo: "Use “on” with days: on Monday, on Friday, on Sunday.",
  },
  {
    place: "A quick phone call",
    story: "The mayor calls. “Do the volunteers work on Saturday?” You check the plan. The volunteers work on Friday. What is the best answer?",
    choices: [
      { label: "“No, they don't. They work on Friday.”", response: "Well done. “Don't” makes a negative sentence with they.", correct: true, hint: "Use don't with I, you, we and they." },
      { label: "“No, they doesn't.”", response: "The auxiliary does not agree with “they”.", correct: false, hint: "Use “don't” with they: “They don't work…”." },
      { label: "“Yes, they works on Saturday.”", response: "The plan says Friday, and “they” takes the base verb.", correct: false, hint: "Check the day and remember: they work, not they works." },
    ],
    evo: "For negatives, use don't with I/you/we/they and doesn't with he/she/it.",
  },
  {
    place: "The clock face",
    story: "You find a drawing of the clock. The long hand points to twelve and the short hand points to nine. What time is it?",
    choices: [
      { label: "Nine o'clock", response: "That's right. The short hand points to nine and the long hand to twelve.", correct: true, hint: "When the long hand points to twelve, it is an exact hour." },
      { label: "Twelve o'clock", response: "The long hand points to twelve, but the short hand shows the hour.", correct: false, hint: "Read the short hand to identify the hour." },
      { label: "Six o'clock", response: "The short hand is not pointing to six.", correct: false, hint: "Look at the short hand, not the long hand." },
    ],
    evo: "For an exact hour, say the number plus “o'clock”: nine o'clock, twelve o'clock.",
  },
  {
    place: "The repair appointment",
    story: "A clockmaker sends a note: “I can visit at half past ten.” Which time does “half past ten” mean?",
    choices: [
      { label: "10:30", response: "Correct. Half past ten is ten thirty.", correct: true, hint: "“Half past” means thirty minutes after the hour." },
      { label: "10:15", response: "That is a quarter past ten, not half past ten.", correct: false, hint: "Half an hour is thirty minutes." },
      { label: "11:30", response: "That is half past eleven.", correct: false, hint: "The hour in the message is ten." },
    ],
    evo: "“Half past ten” means 30 minutes after ten. You can also say “ten thirty”.",
  },
  {
    place: "The daily plan",
    story: "The clockmaker asks about the festival routine: “What time does the parade start?” The schedule says 11:30. Choose the correct question and answer pair.",
    choices: [
      { label: "“What time does the parade start?” — “It starts at eleven thirty.”", response: "Perfect. The question uses does, and the answer uses starts.", correct: true, hint: "With he/she/it, use does in the question and the base verb after does." },
      { label: "“What time do the parade starts?” — “It start at eleven thirty.”", response: "The subject is singular: the parade. Check do/does and the verb form.", correct: false, hint: "Say “does the parade start” and “it starts”." },
      { label: "“What time is the parade start?” — “It starting at eleven thirty.”", response: "The question and answer need present simple forms.", correct: false, hint: "Use “What time does… start?” and “It starts…”." },
    ],
    evo: "Ask about routines with “What time does…?” Answer with “It starts at…”.",
  },
  {
    place: "The mission is complete",
    story: "The clockmaker repairs the tower. The clock shows eleven thirty, just in time for the parade! The mayor asks you to announce the plan. Which announcement is clear and correct?",
    choices: [
      { label: "“The parade starts at eleven thirty. The music show is on Sunday. Enjoy the festival!”", response: "The town cheers. The times and days are clear, and the festival can begin!", correct: true, hint: "Include the correct time, the correct day and a friendly closing." },
      { label: "“The parade start at Sunday eleven. The music show are Friday.”", response: "The time and day are mixed up, and the verbs need attention.", correct: false, hint: "The parade starts at 11:30. The music show is on Sunday." },
      { label: "“The parade starts in eleven thirty. The music show is at Sunday.”", response: "Use “at” for clock times and “on” for days.", correct: false, hint: "Say “at eleven thirty” and “on Sunday”." },
    ],
    evo: "You used times, days, routines and present simple to complete the mission. The town is ready!",
  },
];

export function A1ClockTowerMission() {
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
              <Compass className="size-3.5" aria-hidden="true" /> {t("English Adventures")} · A1 · 03
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("The Clock Tower Mission")}</h1>
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
                {!choice.correct && (
                  <p className="mt-2 text-sm text-muted-foreground" translate="no" lang="en">
                    {t("EVO hint label")} {choice.hint}
                  </p>
                )}
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
            <p className="text-sm leading-relaxed text-muted-foreground" translate="no" lang="en">
              You completed 10 challenges and helped the town repair the clock tower before the parade.
            </p>
            <p className="text-sm font-medium">{t("A1 adventure learning recap")}</p>
            <p className="text-sm text-muted-foreground">
              {t("A1 adventure recovery recap").replace("{count}", String(recovered))}
            </p>
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

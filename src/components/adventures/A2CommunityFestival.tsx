/* eslint-disable prettier/prettier */
import { useState } from "react";
import { ArrowLeft, ArrowRight, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { EnglishAdventureJourneyMap } from "@/components/adventures/EnglishAdventureJourneyMap";
import { AdventureMusicControl } from "@/components/adventures/AdventureMusicControl";
import { EnglishAdventuresAvatar } from "@/components/EnglishAdventuresAvatar";
import { Button } from "@/components/ui/button";
import { useAdventureActivityTimer } from "@/hooks/useEnglishAdventuresProgress";
import { useEnglishAdventureCheckpoint } from "@/hooks/useEnglishAdventureCheckpoint";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { getStableAdventureChoiceOrder } from "@/lib/adventureChoiceOrder";

type Choice = { label: string; response: string; coaching: string };
type Activity = { place: string; story: string; choices: Choice[]; evo: string };

const activities: Activity[] = [
  {
    place: "A new plan",
    story: "EVO is helping you organise a small community festival for Saturday. The team has a park, a few volunteers and a limited budget. Mia asks, “What should we organise first?”",
    choices: [
      { label: "“Let's make a list of the things we need.”", response: "Mia agrees. You write down the tables, chairs, signs and activity materials before making any bookings.", coaching: "Use “Let's…” to make a friendly suggestion. “The things we need” introduces a practical list." },
      { label: "“We bought everything yesterday.”", response: "Mia checks the empty storage room. Nothing has been bought yet, so you decide to plan before spending money.", coaching: "Use the past simple only for completed actions. Here, you are making a plan for the future." },
      { label: "“The festival was more expensive.”", response: "Mia asks what you are comparing. You explain that you need to check the budget first.", coaching: "A comparative needs two things to compare. Explain what is more expensive than something else." },
    ],
    evo: "A good plan starts with a clear list. You do not need to decide everything at once.",
  },
  {
    place: "Checking the weather",
    story: "You check the forecast. It may rain on Saturday afternoon. The outdoor stage is not covered. What should you ask the park manager?",
    choices: [
      { label: "“Is there an indoor space we can use if it rains?”", response: "The manager says there is a community hall nearby. You ask about its availability.", coaching: "Use “Is there…?” to ask whether something exists. “If it rains” describes a possible future situation." },
      { label: "“It rains yesterday, doesn't it?”", response: "The manager is unsure which day you mean. You try again with a clear question about Saturday.", coaching: "For yesterday, use the past: “Did it rain?” For a future possibility, use “if it rains”." },
      { label: "“We don't need a place.”", response: "The manager reminds you that the stage and equipment need protection from the rain.", coaching: "Think about the problem in the story. A backup indoor space can help the event continue." },
    ],
    evo: "Planning for a possible problem is useful. “If it rains…” helps you talk about a real possibility.",
  },
  {
    place: "Booking the hall",
    story: "The community hall is free from 2 p.m. to 6 p.m. on Saturday. You need four hours. How do you confirm the booking?",
    choices: [
      { label: "“Could we book the hall from two to six on Saturday, please?”", response: "The manager checks the calendar and confirms the booking. You have a place for the festival.", coaching: "“Could we…?” is a polite way to make a request. Include the date and time to avoid confusion." },
      { label: "“We are bookinged the hall.”", response: "The manager understands your idea but asks you to repeat the time and date.", coaching: "Say “We are booking the hall” for an arrangement in progress, or “We have booked the hall” after confirmation." },
      { label: "“The hall is bigger yesterday.”", response: "The manager asks whether you want to visit the hall before booking it.", coaching: "Use “bigger” to compare size, and use a present or future time expression for this booking." },
    ],
    evo: "A polite request with clear details makes arrangements easier for everyone.",
  },
  {
    place: "Sharing the tasks",
    story: "Three volunteers are ready to help. Ana can prepare signs, Leo can arrange chairs, and Sam can welcome visitors. How do you divide the jobs?",
    choices: [
      { label: "“Ana can make the signs, Leo can arrange the chairs, and Sam can welcome visitors.”", response: "Everyone knows what to do. The team agrees to meet on Saturday morning.", coaching: "Use “can” to talk about ability or to assign a possible task. Keep the verb in its base form after “can”." },
      { label: "“Ana cans makes the signs.”", response: "Ana understands, but the sentence needs a small correction before you share the tasks.", coaching: "After “can”, use the base verb: “can make”, not “cans makes”." },
      { label: "“Everybody are welcome the visitors.”", response: "Sam asks whether the whole team should welcome visitors or whether the job is his.", coaching: "Use “is” with everybody: “Everybody is…” Or name the person responsible for each task." },
    ],
    evo: "Clear responsibilities help a team work together. Say who can do each task.",
  },
  {
    place: "Choosing the food",
    story: "A local café offers sandwiches, fruit and cakes. One volunteer tells you that she is allergic to nuts. What should you ask the café?",
    choices: [
      { label: "“Do any of the cakes contain nuts?”", response: "The café checks the ingredients and confirms which options are safe and which are not.", coaching: "Use “Do any…?” to ask about ingredients. Food allergies need clear, careful information." },
      { label: "“The cakes are more delicious that fruit.”", response: "The café asks whether you would like to order cakes or fruit. You explain that you first need ingredient information.", coaching: "Use “than” in comparisons: “more delicious than”. But check safety before choosing food." },
      { label: "“She don't eat nuts yesterday.”", response: "The café does not understand whether this is a preference or an allergy. You explain the allergy clearly.", coaching: "Say “She doesn't eat…” for a general fact. For an allergy, say “She is allergic to…”." },
    ],
    evo: "When someone has an allergy, ask direct questions and confirm the ingredients. Never guess.",
  },
  {
    place: "Inviting the neighbours",
    story: "The event is almost ready. You want to invite people who live nearby. Which message sounds friendly and clear?",
    choices: [
      { label: "“Join us this Saturday for music, games and food at the community hall!”", response: "The neighbours like the invitation and ask what time the festival starts.", coaching: "Use the imperative “Join us” for a friendly invitation. Include the day and the main activities." },
      { label: "“You must coming to our festival.”", response: "The message sounds too strong. You rewrite it as a friendly invitation.", coaching: "After “must”, use the base verb: “must come”. For a warm invitation, “Join us” is more natural." },
      { label: "“The festival was next Saturday.”", response: "A neighbour asks whether the festival has already happened. You correct the date.", coaching: "Use “is next Saturday” for a future event, not “was”." },
    ],
    evo: "A good invitation tells people what is happening, when it is happening and where to go.",
  },
  {
    place: "A change of time",
    story: "The hall manager calls. Another group needs the hall until 2:30 p.m., so you can enter thirty minutes later. How do you tell the volunteers?",
    choices: [
      { label: "“The start time has changed. We can enter the hall at half past two.”", response: "The volunteers understand the update and agree to adjust their arrival time.", coaching: "Use the present perfect “has changed” for new information that matters now. “Half past two” means 2:30." },
      { label: "“The start time change yesterday.”", response: "The volunteers ask when the change happened. You explain that the manager has just called.", coaching: "For a completed past action, say “changed”. For a recent update with a result now, say “has changed”." },
      { label: "“We entering at two thirty.”", response: "The team understands the time but asks you to repeat the full sentence.", coaching: "Say “We are entering at two thirty” or “We can enter at two thirty”." },
    ],
    evo: "When plans change, share the new information and explain what people need to do differently.",
  },
  {
    place: "Solving a small problem",
    story: "On Saturday, the speaker does not connect to the music system. The first performance starts in ten minutes. What do you suggest?",
    choices: [
      { label: "“Why don't we use the spare speaker?”", response: "Leo brings the spare speaker. It works, and the performance can start on time.", coaching: "“Why don't we…?” is a natural way to suggest a solution. “Spare” means extra or available for use." },
      { label: "“We should to cancel everything.”", response: "The team looks for another option before cancelling the performance.", coaching: "After “should”, use the base verb: “should cancel”, not “should to cancel”." },
      { label: "“The speaker is connect yesterday.”", response: "Leo asks what is wrong with the speaker. You explain that it will not connect now.", coaching: "Say “The speaker isn't connecting” or “The speaker doesn't connect” to describe the problem." },
    ],
    evo: "Stay calm and look for a practical alternative. A small problem does not have to stop the whole event.",
  },
  {
    place: "Welcoming the visitors",
    story: "The first visitors arrive. A family asks where they can find the games and the food. How do you help them?",
    choices: [
      { label: "“The games are on your left, and the food is next to the main entrance.”", response: "The family thanks you and walks towards the activities. The festival is going well.", coaching: "Use “on your left” and “next to” to give simple, clear directions." },
      { label: "“The games are between of the food.”", response: "The family looks unsure, so you try again with clearer directions.", coaching: "Say “between the food area and the stage” or “next to the food area”. Do not add “of” after “between”." },
      { label: "“Go left yesterday.”", response: "The family asks whether the games are still in the same place. You give directions for now.", coaching: "Use the imperative “Go left” for directions. Do not add a past time expression." },
    ],
    evo: "Short directions are often best. Use familiar place words and check that visitors understand.",
  },
  {
    place: "The festival success",
    story: "At the end of the day, the volunteers are tired but happy. The manager asks how the festival went and what you would improve next time. What do you say?",
    choices: [
      { label: "“It went really well. Next time, we could start preparing the signs earlier.”", response: "The manager agrees. The team celebrates a successful event and has one useful idea for next time.", coaching: "Use the past simple “went” to describe the finished event. “Could” introduces a possible improvement." },
      { label: "“It go very good and we can started earlier.”", response: "The manager understands, but asks you to describe the event again more clearly.", coaching: "Say “It went very well”. After “can” or “could”, use the base verb: “start”." },
      { label: "“We are finish the festival tomorrow.”", response: "The manager smiles and reminds you that the festival has already finished.", coaching: "Say “We have finished the festival” or “We finished the festival”." },
    ],
    evo: "You planned, adapted, helped visitors and reflected on the result. That is real-world communication in action.",
  },
];

const translations: Record<string, string> = {
  "A new plan": "Um novo plano",
  "Checking the weather": "Verificando a previsão do tempo",
  "Booking the hall": "Reservando o salão",
  "Sharing the tasks": "Dividindo as tarefas",
  "Choosing the food": "Escolhendo a comida",
  "Inviting the neighbours": "Convidando os vizinhos",
  "A change of time": "Uma mudança de horário",
  "Solving a small problem": "Resolvendo um pequeno problema",
  "Welcoming the visitors": "Recebendo os visitantes",
  "The festival success": "O sucesso do festival",
  "What would you say?": "O que você diria?",
  "Ocultar tradução": "Ocultar tradução",
  "Ver tradução": "Ver tradução",
  "An adventure about planning a community festival, solving problems and working as a team.": "Uma aventura sobre organizar um festival comunitário, resolver problemas e trabalhar em equipe.",
  "An adventure to practise making suggestions, organising an event, giving directions and adapting to changes.": "Uma aventura para praticar sugestões, organização de eventos, orientações e adaptação a mudanças.",
};

export function A2CommunityFestival() {
  const { lang } = useUiLang();
  const t = (value: string) => (lang === "pt" ? (uiPt[value] ?? translations[value] ?? value) : value);
  const [showTranslation, setShowTranslation] = useState(false);
  const progress = useEnglishAdventureCheckpoint("a2-community-festival", activities.length);
  const index = progress.currentStep;
  const selected = progress.selectedChoice;
  const completed = progress.completed;
  useAdventureActivityTimer(completed ? null : "a2-community-festival:" + index);
  const activity = activities[Math.min(index, activities.length - 1)];
  if (!activity) return null;
  if (!progress.ready) return null;

  function continueStory() {
    if (selected === null) return;
    progress.continueStep();
    setShowTranslation(false);
  }

  function restart() {
    progress.restart();
    setShowTranslation(false);
  }

  const selectedChoice = selected === null ? null : activity.choices[selected];

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
              <Compass className="size-3.5 shrink-0" aria-hidden="true" /> {t("English Adventures")} · A2 · 02
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl" translate="no" lang="en">The Community Festival</h1>
            <p className="text-sm text-muted-foreground">{t("An adventure about planning a community festival, solving problems and working as a team.")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("An adventure to practise making suggestions, organising an event, giving directions and adapting to changes.")}</p>
          </div>
          <div className="col-span-2 row-start-2 w-full min-w-0 sm:absolute sm:right-0 sm:top-[-3.5rem] sm:col-auto sm:row-auto sm:w-auto">
            <AdventureMusicControl welcomeVoice="arabella" />
          </div>
        </header>
        


        {!completed ? (
          <section className="card-soft space-y-4 p-4 sm:p-6" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-green" translate="no" lang="en">{activity.place}</span>
              <span className="text-xs text-muted-foreground">{index + 1} / 10</span>
            </div>
            <p className="text-base leading-relaxed sm:text-lg" translate="no" lang="en">{activity.story}</p>
            <button type="button" onClick={() => setShowTranslation((value) => !value)} aria-expanded={showTranslation} className="inline-flex items-center rounded-lg py-1 text-sm font-medium text-brand-green underline-offset-4 hover:underline">
              {showTranslation ? t("Hide translation") : t("Show translation")}
            </button>
            {showTranslation && <p className="rounded-lg bg-secondary/60 p-3 text-sm leading-relaxed text-muted-foreground" lang="pt">{translations[activity.story] ?? "A tradução deste trecho estará disponível em breve."}</p>}
            <p className="text-sm font-semibold">{t("What would you say?")}</p>
            <div className="grid gap-2">
              {getStableAdventureChoiceOrder("a2-community-festival", activityIndex, activity.choices.length).map((choiceIndex) => {
                const option = activity.choices[choiceIndex];
                return (
                  <button key={option.label} type="button" onClick={() => progress.choose(choiceIndex)} aria-pressed={selected === choiceIndex} className={`rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 ${selected === choiceIndex ? "border-brand-green bg-brand-green/10" : "border-border hover:border-brand-green/50 hover:bg-secondary/50"}`}>
                    <span className="block font-medium" translate="no" lang="en">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedChoice && (
              <div className="rounded-xl bg-brand-green/10 p-3">
                <p className="text-sm leading-relaxed" translate="no" lang="en">{selectedChoice.response}</p>
                <p className="mt-2 text-sm text-muted-foreground" translate="no" lang="en">{selectedChoice.coaching}</p>
                <div className="mt-3 flex items-start gap-2 border-t border-brand-green/20 pt-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground" translate="no" lang="en">{activity.evo}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={continueStory} disabled={selected === null}>
                {index === activities.length - 1 ? t("Finish adventure") : t("Continue the story")}
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
            <p className="text-sm leading-relaxed text-muted-foreground">{t("You planned a community event, shared responsibilities, handled changes and helped the festival succeed.")}</p>
            <p className="text-sm text-muted-foreground">{t("You practised making suggestions, asking polite questions, giving directions and talking about past events.")}</p>
            <p className="text-sm font-medium">{t("Every good adventure is built one decision at a time.")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={restart}><RotateCcw className="mr-1 size-4" />{t("Explore again")}</Button>
              <Button asChild variant="outline"><Link to="/dashboard">{t("Back to home")}</Link></Button>
            </div>
          </section>
        )}
        <EnglishAdventureJourneyMap
          adventureId="a2-community-festival"
          activityIndex={completed ? Math.max(0, index - 1) : index}
          isComplete={completed}
        />
      </div>
    </AppShell>
  );
}

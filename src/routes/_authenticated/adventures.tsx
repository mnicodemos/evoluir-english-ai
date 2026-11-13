import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Compass, Lock, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { AdventureLoading } from "@/components/adventures/AdventureLoading";
import { A1WelcomeMixUp } from "@/components/adventures/A1WelcomeMixUp";
import { A1NeighbourhoodMystery } from "@/components/adventures/A1NeighbourhoodMystery";
import { A2SurpriseDelivery } from "@/components/adventures/A2SurpriseDelivery";
import { A2CommunityFestival } from "@/components/adventures/A2CommunityFestival";
import { AdventureMusicControl } from "@/components/adventures/AdventureMusicControl";
import { EnglishAdventuresAvatar } from "@/components/EnglishAdventuresAvatar";
import { useIsPremium } from "@/components/PremiumBadge";
import { Button } from "@/components/ui/button";
import { useEnglishAdventuresProgress } from "@/hooks/useEnglishAdventuresProgress";
import { useEnglishAdventureCheckpoint } from "@/hooks/useEnglishAdventureCheckpoint";
import { useProfile } from "@/hooks/useProfile";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type Choice = { label: string; response: string };
type Scene = { place: string; story: string; choices: Choice[]; evo: string };

const adventures: Record<
  "a1" | "a2",
  { title: string; subtitle: string; scenes: Scene[]; ending: string }
> = {
  a1: {
    title: "The Missing Bag",
    subtitle: "A little mystery is waiting for you.",
    scenes: [
      {
        place: "At the café",
        story:
          "You are at a café with your friend Mia. She looks worried. “I can't find my bag!” she says. “It is small and blue.”",
        choices: [
          {
            label: "“What does it look like?”",
            response:
              "“It is small and blue. It has a red star!” Mia smiles. “Thank you for asking.”",
          },
          {
            label: "“Where is the train station?”",
            response:
              "Mia points outside. “The station is over there. But first, let's find my bag!”",
          },
          {
            label: "“Don't worry. I can help.”",
            response: "“That's very kind! Let's look together.” Mia feels better.",
          },
        ],
        evo: "Great start! Asking a simple question or offering help keeps the conversation friendly.",
      },
      {
        place: "Near the park",
        story:
          "Mia remembers: “I had my bag after lunch. We walked past the park.” You see a blue bag under a bench.",
        choices: [
          {
            label: "“Is this your bag?”",
            response: "“Maybe! It has a red star. Let's take a closer look.”",
          },
          {
            label: "“Your bag is in the kitchen.”",
            response: "Mia laughs. “Let's check the bench first. It looks promising!”",
          },
          {
            label: "“I saw a small blue bag.”",
            response: "“Really? Where did you see it?” Mia is excited to investigate.",
          },
        ],
        evo: "You are describing what you see and asking where something is. Every clue moves the story forward.",
      },
      {
        place: "A happy discovery",
        story:
          "The bag is under the bench! Mia checks inside. Her keys and notebook are there. “You found it!”",
        choices: [
          {
            label: "“I'm happy we found it!”",
            response: "“Me too! Thank you for helping me.”",
          },
          {
            label: "“Here you are. Have a nice day!”",
            response: "Mia takes her bag. “Thanks! You too!”",
          },
          {
            label: "“Let's celebrate with a cake!”",
            response: "Mia laughs. “That sounds like a wonderful idea!”",
          },
        ],
        evo: "You helped solve the mystery using descriptions, places and friendly expressions. What a lovely adventure!",
      },
    ],
    ending: "A small mystery, a helpful friend and a happy ending. You made it happen!",
  },
  a2: {
    title: "The Surprise Delivery",
    subtitle: "An unexpected delivery needs a clever solution.",
    scenes: [
      {
        place: "A package arrives",
        story:
          "A package arrives at your door. You ordered a blue desk lamp, but the box is damaged. The lamp inside is broken.",
        choices: [
          {
            label: "“The package arrived damaged.”",
            response: "That is clear and helpful. You explain exactly what happened.",
          },
          {
            label: "“I received the wrong weather.”",
            response:
              "The delivery agent looks confused. Try describing the package and the problem.",
          },
          {
            label: "“Could you help me with this order?”",
            response: "“Of course. Can you tell me what is wrong?” the agent asks.",
          },
        ],
        evo: "Good communication starts by describing the problem calmly and clearly.",
      },
      {
        place: "Contacting customer support",
        story:
          "You contact the store. The agent asks for more information about the order and the damage.",
        choices: [
          {
            label: "“The box was wet and one corner was crushed.”",
            response: "“Thank you. That helps us understand the problem,” says the agent.",
          },
          {
            label: "“I bought it last year.”",
            response: "The agent asks if you can share details about this delivery instead.",
          },
          {
            label: "“I would like a replacement, please.”",
            response: "“Certainly. Let me check the replacement options.”",
          },
        ],
        evo: "You can explain what happened and make a polite request. Those details help find a solution.",
      },
      {
        place: "Finding a solution",
        story:
          "The store offers a replacement or a refund. You would still like the lamp, but you need it in good condition.",
        choices: [
          {
            label: "“A replacement would be perfect, thank you.”",
            response: "“No problem. We will send another lamp and email the details.”",
          },
          {
            label: "“I don't want any solution.”",
            response: "The agent waits. You can tell them what would make things right.",
          },
          {
            label: "“When can I expect the new one?”",
            response: "“It should arrive within three business days.”",
          },
        ],
        evo: "You explained the issue, asked for what you needed and confirmed the next step. Nicely handled!",
      },
    ],
    ending: "You turned an unexpected problem into a clear conversation and a practical solution.",
  },
};

export const Route = createFileRoute("/_authenticated/adventures")({
  validateSearch: (search: Record<string, unknown>) => ({
    story: typeof search["story"] === "string" ? search["story"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "English Adventures - Evoluir+ English AI" },
      {
        name: "description",
        content: "Explore a playful English story with EVO.",
      },
      { property: "og:title", content: "English Adventures - Evoluir+ English AI" },
      { property: "og:description", content: "Explore a playful English story with EVO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnglishAdventuresPage,
});

function EnglishAdventuresPage() {
  const { story } = Route.useSearch();
  const { data: profile } = useProfile();
  // When /adventures is reopened without a story parameter, resume at A1.2
  // once A1.1 is already complete instead of showing the old completion screen.
  const welcomeCheckpoint = useEnglishAdventureCheckpoint("a1-welcome-mix-up", 10);
  const premium = useIsPremium();
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const level = (profile?.max_level || profile?.level || "a1").toLowerCase();
  const key: "a1" | "a2" = level === "a2" ? "a2" : "a1";
  const adventure = adventures[key];
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const { markCompleted } = useEnglishAdventuresProgress();

  if (premium === false) {
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
          <section className="card-soft space-y-3 p-6 text-center">
            <Lock className="mx-auto size-8 text-warning" aria-hidden="true" />
            <h1 className="font-display text-xl font-semibold">
              {t("English Adventures is a Premium feature")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("Unlock the stories with EVO and keep exploring your English.")}
            </p>
            <Button asChild>
              <Link to="/premium">{t("See plans")}</Link>
            </Button>
          </section>
        </div>
      </AppShell>
    );
  }

  if (story === "neighbourhood-mystery") return <A1NeighbourhoodMystery />;
  if (key === "a2" && story === "a2-1") return <A2SurpriseDelivery />;
  if (key === "a2" && story === "a2-2") return <A2CommunityFestival />;
  // A2 without a story opens the first saved A2 adventure, never a disconnected fallback.
  if (key === "a2") return <A2SurpriseDelivery />;
  if (key === "a1") {
    // Do not briefly render A1.1 while the cloud checkpoint is loading.
    // Once A1.1 is complete, resume directly at A1.2, including its saved
    // completion screen when the student has already finished both adventures.
    if (!welcomeCheckpoint.ready) return <AdventureLoading />;
    return welcomeCheckpoint.completed ? <A1NeighbourhoodMystery /> : <A1WelcomeMixUp />;
  }

  const scene = adventure.scenes[sceneIndex] ?? adventure.scenes[0];
  if (!scene) return null;

  function choose(index: number) {
    setSelected(index);
  }

  function continueStory() {
    if (sceneIndex === adventure.scenes.length - 1) {
      setFinished(true);
      markCompleted(key === "a2" ? "a2-surprise-delivery" : "a1-missing-bag");
    } else {
      setSceneIndex((value) => value + 1);
      setSelected(null);
    }
  }

  function restart() {
    setSceneIndex(0);
    setSelected(null);
    setFinished(false);
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
          <EnglishAdventuresAvatar className="size-16 sm:size-20" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-green">
              <Compass className="size-3.5" aria-hidden="true" /> {t("English Adventures")} ·{" "}
              {String(key).toUpperCase()}
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{adventure.title}</h1>
            <p className="text-sm text-muted-foreground">{t(adventure.subtitle)}</p>
          </div>
          {key === "a2" ? (
            <div className="w-full min-w-0 sm:ml-auto sm:w-auto">
              <AdventureMusicControl welcomeVoice="arabella" />
            </div>
          ) : null}
        </header>

        {!finished ? (
          <section className="card-soft space-y-4 p-4 sm:p-6" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-green">
                {t(scene.place)}
              </span>
              <span className="text-xs text-muted-foreground">
                {sceneIndex + 1} / {adventure.scenes.length}
              </span>
            </div>
            <p className="text-base leading-relaxed sm:text-lg" translate="no" lang="en">
              {scene.story}
            </p>
            <div className="grid gap-2">
              {scene.choices.map((choice, index) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => choose(index)}
                  aria-pressed={selected === index}
                  className={`rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60 ${
                    selected === index
                      ? "border-brand-green bg-brand-green/10"
                      : "border-border hover:border-brand-green/50 hover:bg-secondary/50"
                  }`}
                >
                  <span className="font-medium" translate="no" lang="en">
                    {choice.label}
                  </span>
                </button>
              ))}
            </div>
            {selected !== null && (
              <div className="rounded-xl bg-brand-green/10 p-3">
                <p className="text-sm leading-relaxed" translate="no" lang="en">
                  {scene.choices[selected]?.response}
                </p>
                <div className="mt-3 flex items-start gap-2 border-t border-brand-green/20 pt-3">
                  <Sparkles
                    className="mt-0.5 size-4 shrink-0 text-brand-green"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground">{t(scene.evo)}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={continueStory} disabled={selected === null}>
                {sceneIndex === adventure.scenes.length - 1
                  ? t("Finish adventure")
                  : t("Continue the story")}
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
            <p className="text-sm leading-relaxed text-muted-foreground">{t(adventure.ending)}</p>
            <p className="text-sm font-medium">{t("Your English. Your world. New experiences.")}</p>
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

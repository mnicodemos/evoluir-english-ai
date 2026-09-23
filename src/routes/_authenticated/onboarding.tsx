import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EvoGuide } from "@/components/EvoGuide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { PLACEMENT_QUESTIONS, scorePlacement } from "@/lib/placementTest";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Evoluir+ English AI · Set up your plan" },
      { name: "description", content: "Tell AI Talking your level, goal and daily study time." },
      { property: "og:title", content: "Evoluir+ English AI · Set up your plan" },
      {
        property: "og:description",
        content: "Tell AI Talking your level, goal and daily study time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const goals = [
  { value: "conversation", label: "Conversation", hint: "Speak naturally in any situation" },
  { value: "work", label: "Work", hint: "Meetings, emails and presentations" },
  { value: "travel", label: "Travel", hint: "Airports, hotels and restaurants" },
  { value: "interview", label: "Interview", hint: "Land a job at a global company" },
  { value: "certification", label: "Certification", hint: "TOEFL, IELTS and similar" },
];

const times = [10, 20, 30];

function Onboarding() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("conversation");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState(15);
  const [saving, setSaving] = useState(false);

  const result = scorePlacement(answers);
  const level = result.level.value;
  const answeredAll = Object.keys(answers).length === PLACEMENT_QUESTIONS.length;

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  async function finish() {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || "Student",
          goal,
          level,
          max_level: level,
          daily_minutes: minutes,
          onboarding_completed: true,
        })
        .eq("id", profile.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your plan");
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "What should we call you?",
      body: (
        <div className="space-y-5">
          <EvoGuide
            title={t("Hi. I'm EVO.")}
            description={t(
              "I'll help you understand where you are in English and find a good starting point.",
            )}
            imageSize="diagnosisIntro"
            className="card-soft px-4 py-3"
          />
          <div className="space-y-2">
            <Label htmlFor="name">{t("Your name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marcelo"
            />
          </div>
        </div>
      ),
      canContinue: true,
    },
    {
      title: "What is your main goal?",
      body: <Options options={goals} value={goal} onChange={setGoal} />,
      canContinue: true,
    },
    {
      title: "Placement test",
      body: (
        <PlacementTest
          answers={answers}
          onAnswer={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
        />
      ),
      canContinue: answeredAll,
    },
    {
      title: "Your CEFR level",
      body: (
        <div className="space-y-4">
          <EvoGuide
            title={t("Now we have a clearer view of where you are.")}
            description={t("Let's turn this result into your next step.")}
            imageSize="diagnosis"
            className="card-soft p-4"
          />
          <div className="card-soft p-5">
            <p className="text-sm text-muted-foreground">Your starting level</p>
            <p className="mt-1 text-2xl font-bold">{result.level.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">{result.level.hint}</p>
            <p className="mt-3 text-sm font-medium">
              {result.correct} of {result.total} correct answers
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {result.byBand.map((b) => (
              <div key={b.band} className="rounded-lg border border-border p-2">
                <p className="font-semibold uppercase">{b.band}</p>
                <p className="text-muted-foreground">
                  {b.correct}/{b.total}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Your lessons will start at this level and move up when you close the Diamond league with
            an overall average of 70% or more.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setAnswers({});
              setStep(2);
            }}
          >
            Retake the test
          </Button>
        </div>
      ),
      canContinue: true,
    },
    {
      title: "How much time do you have per day?",
      body: (
        <Options
          options={times.map((t) => ({
            value: String(t),
            label: `${t} minutes/day`,
            hint: t === 10 ? "Quick daily habit" : t === 20 ? "Steady progress" : "Fast track",
          }))}
          value={String(minutes)}
          onChange={(v) => setMinutes(Number(v))}
        />
      ),
      canContinue: true,
    },
  ];

  const current = steps[step]!;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-10">
        <div className="flex items-center gap-2">
          <Logo className="size-[1.8rem] shrink-0 self-center" />
          <span className="font-display font-semibold">Evoluir+ English AI</span>
        </div>

        <div className="mt-8 flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="mt-10 flex-1 animate-rise">
          <p className="text-sm font-medium text-muted-foreground">
            Step {step + 1} of {steps.length}
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{current.title}</h1>
          <div className="mt-7">{current.body}</div>
        </div>

        <div className="mt-10 flex gap-3">
          {step > 0 && (
            <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1"
            disabled={saving || !current.canContinue}
            onClick={() => (step === steps.length - 1 ? finish() : setStep(step + 1))}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {step === steps.length - 1 ? "Create my plan" : "Continue"}
            {!saving && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Graded CEFR questions, from A1 to C2, used to place the student. */
function PlacementTest({
  answers,
  onAnswer,
}: {
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Answer all {PLACEMENT_QUESTIONS.length} questions. They get harder as you go — it is normal
        not to know the last ones.
      </p>
      {PLACEMENT_QUESTIONS.map((q, index) => (
        <fieldset key={q.id} className="card-soft p-4">
          <legend className="sr-only">{`Question ${index + 1}`}</legend>
          <p className="text-sm font-medium">
            {index + 1}. {q.prompt}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onAnswer(q.id, option)}
                className={`rounded-lg border p-2.5 text-left text-sm transition-colors ${
                  answers[q.id] === option
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function Options({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; hint: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`card-soft flex items-center justify-between p-4 text-left transition-all ${
            value === o.value ? "ring-2 ring-ring" : "hover:shadow-[var(--shadow-lift)]"
          }`}
        >
          <span>
            <span className="block font-medium">{o.label}</span>
            <span className="block text-sm text-muted-foreground">{o.hint}</span>
          </span>
          <span
            className={`size-4 rounded-full border-2 ${value === o.value ? "border-transparent bg-primary" : "border-border"}`}
          />
        </button>
      ))}
    </div>
  );
}

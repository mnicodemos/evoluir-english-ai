import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { BrandName } from "@/components/BrandName";
import { Logo } from "@/components/Logo";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EvoAvatar } from "@/components/EvoAvatar";
import { EvoGuide } from "@/components/EvoGuide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { PlacementTest } from "@/components/onboarding/PlacementTest";
import { placementComplete, scorePlacement } from "@/lib/placementTest";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your plan - Evoluir+ English AI" },
      { name: "description", content: "Tell EVO your level, goal and daily study time." },
      { property: "og:title", content: "Set up your plan - Evoluir+ English AI" },
      {
        property: "og:description",
        content: "Tell EVO your level, goal and daily study time.",
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
  // One of the offered options, so a choice is visibly selected from the start.
  const [minutes, setMinutes] = useState(20);
  const [saving, setSaving] = useState(false);

  const result = scorePlacement(answers);
  const level = result.level.value;
  const testDone = placementComplete(answers);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  /** Saves the plan; new students go straight into their first conversation. */
  async function finish(to: "/coach" | "/dashboard") {
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
      navigate({ to, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your plan");
    } finally {
      setSaving(false);
    }
  }

  // Three steps (user request: first conversation with EVO in under 2 minutes):
  // about you, the placement test, then the level with the daily time and the
  // way straight into AI Speaking.
  const steps = [
    {
      title: "Tell EVO about you",
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
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("What is your main goal?")}</p>
            <Options options={goals} value={goal} onChange={setGoal} compact />
          </div>
        </div>
      ),
      canContinue: true,
    },
    {
      title: "Placement test",
      body: (
        <PlacementTest
          answers={answers}
          onAnswer={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
          t={t}
        />
      ),
      canContinue: testDone,
    },
    {
      title: "Your CEFR level",
      body: (
        <div className="space-y-4">
          <div className="card-soft p-5">
            <p className="text-sm text-muted-foreground">Your starting level</p>
            <p className="mt-1 text-2xl font-bold">{result.level.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">{result.level.hint}</p>
            <p className="mt-3 text-sm font-medium">
              {result.correct} of {result.total} correct answers
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("How much time do you have per day?")}</p>
            <div className="grid grid-cols-3 gap-2">
              {times.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={minutes === option}
                  onClick={() => setMinutes(option)}
                  className={`rounded-xl border p-3 text-center transition-colors ${
                    minutes === option
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <span className="block font-display text-lg font-bold">{option}</span>
                  <span className="block text-xs text-muted-foreground">min</span>
                </button>
              ))}
            </div>
          </div>
          <EvoGuide
            title={t("Now let's talk.")}
            description={t(
              "Your first conversation takes about 2 minutes: I speak first, you answer by voice.",
            )}
            imageSize="diagnosis"
            className="card-soft p-4"
          />
          <Button
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            onClick={() => {
              setAnswers({});
              setStep(1);
            }}
          >
            Retake the test
          </Button>
        </div>
      ),
      canContinue: true,
    },
  ];

  const current = steps[step]!;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-10">
        <div className="flex items-center gap-2">
          <Logo className="size-[2.25rem] shrink-0 self-center" />
          <BrandName />
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

        {step === steps.length - 1 ? (
          <div className="mt-10 space-y-2">
            <Button
              size="lg"
              className="w-full"
              disabled={saving}
              onClick={() => void finish("/coach")}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <EvoAvatar decorative className="size-7 ring-1 sm:size-7" />
              )}
              Talk to EVO now
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="flex-1"
                disabled={saving}
                onClick={() => void finish("/dashboard")}
              >
                Go to my Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-10 flex gap-3">
            {step > 0 && (
              <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button
              size="lg"
              className="flex-1"
              disabled={!current.canContinue}
              onClick={() => setStep(step + 1)}
            >
              {step === 1 ? "See my level" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Options({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: { value: string; label: string; hint: string }[];
  value: string;
  onChange: (v: string) => void;
  /** Tighter cards, so several questions fit on one phone screen. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3"}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`card-soft flex items-center justify-between text-left transition-all ${compact ? "px-4 py-2.5" : "p-4"} ${
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

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass } from "lucide-react";

import { ProofOfProgressCard } from "@/components/ProofOfProgressCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import {
  buildLearningJourney,
  LEARNING_JOURNEY_EMPTY_TEXT,
  LEARNING_JOURNEY_TEXT,
} from "@/lib/pedagogy/learningJourney";
import { NEXT_STEP_SKILL_TEXT } from "@/lib/pedagogy/nextStep";
import { loadNextStep } from "@/lib/pedagogy/nextStep.functions";
import { loadProofOfProgress } from "@/lib/pedagogy/proofOfProgress.functions";
import { SMART_REVIEW_REASON_TEXT } from "@/lib/pedagogy/smartReviewUx";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * "Your journey" — one integrated reading of what the existing layers already
 * decided: where the student is (official CEFR), what already evolved (the
 * existing Proof of Progress section, reused as-is), what deserves attention
 * (the existing Smart Review recommendation) and the next move (the existing
 * Skill Quest / Next Step resource). No new intelligence, no new score, no AI.
 */
export function LearningJourneyCard() {
  const { lang } = useUiLang();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const { data: profile } = useProfile();

  // Same query keys already used by the dashboard sections: cached, no new call.
  const step = useQuery({
    queryKey: ["next-step", profile?.level ?? null],
    queryFn: () => loadNextStep({ data: undefined }),
    enabled: !!profile,
    staleTime: 60 * 1000,
  });
  const proof = useQuery({
    queryKey: ["proof-of-progress", profile?.level ?? null],
    queryFn: () => loadProofOfProgress({ data: undefined }),
    enabled: !!profile,
    staleTime: 60 * 1000,
  });

  if (step.isLoading || proof.isLoading) {
    return (
      <section
        className="card-soft mt-5 p-5"
        aria-busy="true"
        aria-label={t(LEARNING_JOURNEY_TEXT.title)}
      >
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
      </section>
    );
  }

  // A partial error simply drops the affected block — the page never breaks.
  const journey = buildLearningJourney({
    proof: proof.isError ? null : (proof.data ?? null),
    nextStep: step.isError ? null : (step.data ?? null),
    currentLevel: profile?.level ?? null,
  });

  const skillLabel = (skill: string) => t(NEXT_STEP_SKILL_TEXT[skill] ?? skill);

  return (
    <section className="card-soft mt-5 p-5" aria-labelledby="learning-journey-title">
      <div className="flex min-w-0 items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
          <Compass className="size-5 text-[oklch(0.45_0.11_255)]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="learning-journey-title" className="text-lg font-semibold">
            {t(LEARNING_JOURNEY_TEXT.title)}
          </h2>
          <p className="text-sm text-muted-foreground">{t(LEARNING_JOURNEY_TEXT.subtitle)}</p>

          {!journey.hasData ? (
            <p className="mt-3 break-words text-sm text-muted-foreground">
              {t(LEARNING_JOURNEY_EMPTY_TEXT)}
            </p>
          ) : (
            <>
              <div className="mt-4">
                <h3 className="text-sm font-semibold">{t(LEARNING_JOURNEY_TEXT.where)}</h3>
                {journey.currentLevel && (
                  <p className="mt-1 break-words text-sm">
                    {t(LEARNING_JOURNEY_TEXT.level)}:{" "}
                    <span className="font-medium">{journey.currentLevel.toUpperCase()}</span>
                  </p>
                )}
                {journey.evidenceSkills.length > 0 && (
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {t(LEARNING_JOURNEY_TEXT.evidence)}:{" "}
                    {journey.evidenceSkills.map(skillLabel).join(" · ")}
                  </p>
                )}
                {journey.hasTransfer && (
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {t(LEARNING_JOURNEY_TEXT.transfer)}
                  </p>
                )}
              </div>

              {journey.attention && (
                <div className="mt-4 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold">{t(LEARNING_JOURNEY_TEXT.attention)}</h3>
                  <p className="mt-1 break-words font-medium">
                    {skillLabel(journey.attention.skill)}
                  </p>
                  <p className="mt-0.5 break-words text-sm text-muted-foreground">
                    {t(SMART_REVIEW_REASON_TEXT[journey.attention.category])}
                  </p>
                </div>
              )}

              {journey.nextMove && (
                <div className="mt-4 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold">{t(LEARNING_JOURNEY_TEXT.nextMove)}</h3>
                  <p className="mt-1 break-words text-sm">
                    <span className="font-medium">{t(journey.nextMove.title)}</span>
                  </p>
                  {journey.nextMove.params ? (
                    <Button asChild className="mt-3 w-full sm:w-auto">
                      <Link
                        to="/learning/$lessonId"
                        params={journey.nextMove.params}
                        aria-label={`${t(LEARNING_JOURNEY_TEXT.cta)}: ${t(journey.nextMove.title)}`}
                      >
                        {t(LEARNING_JOURNEY_TEXT.cta)}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="mt-3 w-full sm:w-auto">
                      <Link
                        to={journey.nextMove.to}
                        aria-label={`${t(LEARNING_JOURNEY_TEXT.cta)}: ${t(journey.nextMove.title)}`}
                      >
                        {t(LEARNING_JOURNEY_TEXT.cta)}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* "What you already evolved": the existing section, reused, never rebuilt. */}
      <ProofOfProgressCard />
    </section>
  );
}

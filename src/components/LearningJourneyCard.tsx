import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass } from "lucide-react";

import { ProofOfProgressCard, ProofOfProgressEvoBanner } from "@/components/ProofOfProgressCard";
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
        className="card-soft mt-3 p-3 sm:mt-5 sm:p-5"
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
    <div className="mt-3 grid items-start gap-3 sm:mt-5 sm:gap-5 lg:grid-cols-2">
      {/* Mobile: EVO banner comes first; desktop keeps the banner spanning both columns above the two cards. */}
      <section
        className="card-soft order-2 min-w-0 p-3 sm:p-5 lg:order-none lg:col-start-1 lg:row-start-2"
        aria-labelledby="learning-journey-title"
      >
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary sm:size-11">
            <Compass className="size-4 text-[oklch(0.45_0.11_255)] sm:size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="learning-journey-title" className="text-base font-semibold sm:text-lg">
              {t(LEARNING_JOURNEY_TEXT.title)}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t(LEARNING_JOURNEY_TEXT.subtitle)}
            </p>

            {!journey.hasData ? (
              <p className="mt-3 break-words text-sm text-muted-foreground">
                {t(LEARNING_JOURNEY_EMPTY_TEXT)}
              </p>
            ) : (
              <>
                <div className="mt-3 sm:mt-4">
                  <h3 className="text-xs font-semibold sm:text-sm">
                    {t(LEARNING_JOURNEY_TEXT.where)}
                  </h3>
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
                  <div className="mt-3 border-t border-border pt-3 sm:mt-4 sm:pt-4">
                    <h3 className="text-xs font-semibold sm:text-sm">
                      {t(LEARNING_JOURNEY_TEXT.attention)}
                    </h3>
                    <p className="mt-1 break-words font-medium">
                      {skillLabel(journey.attention.skill)}
                    </p>
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">
                      {t(SMART_REVIEW_REASON_TEXT[journey.attention.category])}
                    </p>
                  </div>
                )}

                {journey.nextMove && (
                  <div className="mt-3 border-t border-border pt-3 sm:mt-4 sm:pt-4">
                    <h3 className="text-xs font-semibold sm:text-sm">
                      {t(LEARNING_JOURNEY_TEXT.nextMove)}
                    </h3>
                    <p className="mt-1 break-words text-sm">
                      <span className="font-medium">{t(journey.nextMove.title)}</span>
                    </p>
                    {journey.nextMove.params ? (
                      <Button asChild className="mt-2 h-9 w-full sm:mt-3 sm:w-auto">
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
                      <Button asChild className="mt-2 h-9 w-full sm:mt-3 sm:w-auto">
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
      </section>

      {/* "What you already evolved": the existing section, reused, never rebuilt. */}
      <div className="order-1 min-w-0 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-1">
        <ProofOfProgressEvoBanner />
      </div>

      <div className="order-3 min-w-0 lg:order-none lg:col-start-2 lg:row-start-2">
        <ProofOfProgressCard />
      </div>
    </div>
  );
}

import { CheckCircle2, RotateCcw, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { challengeFor, challengeOption, challengeStorageKey } from "@/lib/realLifeChallenges";
import { readStorage, writeStorage } from "@/lib/safeStorage";
import { cn } from "@/lib/utils";

/** Optional practice under the Learning Guide; never affects the lesson's completion. */
export function RealLifeChallengeCard({
  lessonKey,
  userId,
  t,
}: {
  lessonKey: string | null | undefined;
  userId: string | null | undefined;
  t: (text: string) => string;
}) {
  const challenge = challengeFor(lessonKey);
  const [selected, setSelected] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!userId || !lessonKey) return;
    setCompleted(readStorage(challengeStorageKey(userId, lessonKey)) === "done");
  }, [userId, lessonKey]);

  if (!challenge) return null;
  const chosen = challengeOption(challenge, selected);

  function finish() {
    setCompleted(true);
    if (userId && lessonKey) writeStorage(challengeStorageKey(userId, lessonKey), "done");
  }

  return (
    <section
      className="space-y-4 border-t border-border/60 pt-5"
      aria-labelledby="real-life-challenge-title"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id="real-life-challenge-title" className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-primary" aria-hidden="true" />
          <span>{t("Real-Life Challenge")}</span>
        </h3>
        {completed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/15 px-2 py-0.5 text-xs text-brand-green">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> {t("Completed")}
          </span>
        )}
      </div>

      <div translate="no" className="space-y-2 rounded-lg bg-secondary/40 px-3 py-3 text-sm leading-relaxed">
        <p className="font-medium">{challenge.title}</p>
        <p className="text-muted-foreground">{challenge.situation}</p>
        <p className="font-medium">{challenge.task}</p>
      </div>

      <div className="grid gap-2" role="radiogroup" aria-label={t("Choose your email")}>
        {challenge.options.map((option, index) => {
          const isChosen = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={!!selected && !isChosen}
              onClick={() => setSelected(option.id)}
              className={cn(
                "flex min-h-11 gap-3 rounded-lg border px-3 py-2.5 text-left text-sm leading-relaxed transition-colors",
                isChosen
                  ? option.outcome === "works"
                    ? "border-brand-green/60 bg-brand-green/10"
                    : "border-amber-500/50 bg-amber-500/10"
                  : "border-border/60 bg-background/60 hover:border-primary/50",
                !!selected && !isChosen && "opacity-50",
              )}
            >
              <span className="shrink-0 font-semibold text-primary">
                {String.fromCharCode(65 + index)}.
              </span>
              <span translate="no">{option.text}</span>
            </button>
          );
        })}
      </div>

      {chosen && (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("What happens")}
            </p>
            <p translate="no">{chosen.consequence}</p>
          </div>
          <div className="flex gap-3 rounded-lg bg-primary/5 px-3 py-3 text-sm">
            <EvoAvatar decorative className="size-10 sm:size-10" />
            <div>
              <p className="mb-1 text-xs font-semibold text-primary">{t("EVO explains")}</p>
              <p translate="no" className="leading-relaxed">{chosen.feedback}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
              <RotateCcw className="size-4" aria-hidden="true" /> {t("Try another approach")}
            </Button>
            {!completed && (
              <Button size="sm" onClick={finish}>
                <CheckCircle2 className="size-4" aria-hidden="true" /> {t("Finish challenge")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

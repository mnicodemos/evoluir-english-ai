import { BriefcaseBusiness, CheckCircle2, RotateCcw, Target, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { EvoAvatar } from "@/components/EvoAvatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "pending" | "local-only">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    setSyncReady(false);
    setSyncStatus("loading");
    setSelected(null);
    setCompleted(false);
    if (!userId || !lessonKey) {
      setSyncReady(true);
      setSyncStatus("synced");
      return;
    }

    async function loadProgress() {
      const localCompleted = readStorage(challengeStorageKey(userId!, lessonKey!)) === "done";
      const localSelectionKey = `real-life-challenge-selection:${userId}:${lessonKey}`;
      const localSelected = readStorage(localSelectionKey);

      try {
        const { data, error } = await supabase
          .from("real_life_challenge_progress")
          .select("selected_option_id, completed")
          .eq("user_id", userId!)
          .eq("lesson_key", lessonKey!)
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        if (data) {
          const remoteSelected =
            data.selected_option_id &&
            challenge?.options.some((option) => option.id === data.selected_option_id)
              ? data.selected_option_id
              : null;
          const restoredSelection =
            remoteSelected ??
            (localSelected && challenge?.options.some((option) => option.id === localSelected)
              ? localSelected
              : null);
          // Completion is monotonic: a locally completed challenge must not be
          // silently downgraded by an older/incomplete server record.
          const restoredCompleted = data.completed || localCompleted;
          setSelected(restoredSelection);
          setCompleted(restoredCompleted);
          if (restoredCompleted) writeStorage(challengeStorageKey(userId!, lessonKey!), "done");
          if (restoredSelection) writeStorage(localSelectionKey, restoredSelection);

          if (
            restoredCompleted !== data.completed ||
            restoredSelection !== data.selected_option_id
          ) {
            const { error: reconcileError } = await supabase
              .from("real_life_challenge_progress")
              .upsert(
                {
                  user_id: userId!,
                  lesson_key: lessonKey!,
                  selected_option_id: restoredSelection,
                  completed: restoredCompleted,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,lesson_key" },
              );
            if (reconcileError) throw reconcileError;
          }
        } else {
          const restoredSelection =
            localSelected && challenge?.options.some((option) => option.id === localSelected)
              ? localSelected
              : null;
          setSelected(restoredSelection);
          setCompleted(localCompleted);
          if (restoredSelection || localCompleted) {
            const { error: saveError } = await supabase.from("real_life_challenge_progress").upsert(
              {
                user_id: userId!,
                lesson_key: lessonKey!,
                selected_option_id: restoredSelection,
                completed: localCompleted,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,lesson_key" },
            );
            if (saveError) throw saveError;
          }
        }
        setSyncStatus("synced");
      } catch {
        if (cancelled) return;
        setSyncStatus("local-only");
        const restoredSelection =
          localSelected && challenge?.options.some((option) => option.id === localSelected)
            ? localSelected
            : null;
        setSelected(restoredSelection);
        setCompleted(localCompleted);
      } finally {
        if (!cancelled) setSyncReady(true);
      }
    }

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [userId, lessonKey, challenge]);

  if (!challenge) return null;
  const chosen = challengeOption(challenge, selected);

  async function persistProgress(optionId: string | null, isCompleted: boolean) {
    if (!userId || !lessonKey) return;
    const selectionKey = `real-life-challenge-selection:${userId}:${lessonKey}`;
    if (optionId) writeStorage(selectionKey, optionId);
    else writeStorage(selectionKey, "");
    if (isCompleted) writeStorage(challengeStorageKey(userId, lessonKey), "done");
    setSyncStatus("pending");
    try {
      const { error } = await supabase.from("real_life_challenge_progress").upsert(
        {
          user_id: userId,
          lesson_key: lessonKey,
          selected_option_id: optionId,
          completed: isCompleted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_key" },
      );
      if (error) throw error;
      setSyncStatus("synced");
    } catch {
      // Keep the local state usable offline, but make the failed sync visible
      // and let the learner explicitly retry without losing local progress.
      setSyncStatus("pending");
    }
  }

  function retrySync() {
    void persistProgress(selected, completed);
  }

  function chooseOption(optionId: string) {
    setSelected(optionId);
    void persistProgress(optionId, completed);
  }

  function retry() {
    setSelected(null);
    void persistProgress(null, completed);
  }

  function finish() {
    setCompleted(true);
    if (userId && lessonKey) writeStorage(challengeStorageKey(userId, lessonKey), "done");
    void persistProgress(selected, true);
  }

  return (
    <section
      className="card-soft relative space-y-5 overflow-hidden border border-primary/25 p-4 sm:p-6"
      aria-labelledby="real-life-challenge-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary/70"
      />
      <header className="flex items-start gap-3 pt-1">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Target className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            EVO · {t("Real-Life Challenge")}
          </p>
          <h3
            id="real-life-challenge-title"
            className="text-lg font-semibold leading-snug sm:text-xl"
          >
            {t("Put your English to the test")}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("Practice a real situation. Choose what you would say.")}
          </p>
        </div>
        {completed && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-green/15 px-2 py-1 text-xs font-medium text-brand-green">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> {t("Completed")}
          </span>
        )}
      </header>

      <div className="space-y-2 rounded-xl border border-border/60 bg-secondary/30 p-3 sm:p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <BriefcaseBusiness className="size-4" aria-hidden="true" />
          {t("Your mission")}
        </p>
        <div translate="no" className="space-y-2 text-sm leading-relaxed">
          <p className="font-semibold text-foreground">{challenge.title}</p>
          <p className="text-muted-foreground">{challenge.situation}</p>
          <p className="font-medium text-foreground">{challenge.task}</p>
        </div>
      </div>

      <div className="space-y-2.5" role="radiogroup" aria-label={t("Choose your email")}>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("Choose your response")}
        </p>
        {challenge.options.map((option, index) => {
          const isChosen = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={(!!selected && !isChosen) || !syncReady}
              onClick={() => chooseOption(option.id)}
              className={cn(
                "flex min-h-12 w-full items-start gap-3 rounded-xl border p-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isChosen
                  ? option.outcome === "works"
                    ? "border-brand-green/60 bg-brand-green/10 ring-1 ring-brand-green/30"
                    : "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/20"
                  : "border-border/70 bg-background/70 hover:border-primary/60 hover:bg-primary/5",
                !!selected && !isChosen && "opacity-55",
                !syncReady && "cursor-wait",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold",
                  isChosen
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary/60 text-foreground",
                )}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span translate="no" className="min-w-0 flex-1 pt-0.5">
                {option.text}
              </span>
              {isChosen && (
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </button>
          );
        })}
        {!syncReady && (
          <p className="text-xs text-muted-foreground">{t("Loading saved challenge progress…")}</p>
        )}
      </div>

      {syncStatus === "local-only" && (
        <div
          className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p>
            {t("Progress is available on this device, but could not be loaded from the server.")}
          </p>
          <Button size="sm" variant="outline" onClick={retrySync}>
            {t("Retry sync")}
          </Button>
        </div>
      )}
      {syncStatus === "pending" && (
        <div
          className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p>{t("Your progress is saved on this device and is waiting to sync.")}</p>
          <Button size="sm" variant="outline" onClick={retrySync}>
            {t("Retry sync")}
          </Button>
        </div>
      )}

      {chosen && (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-xl border border-border/70 bg-background/70 p-3 sm:p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("What happens")}
            </p>
            <p translate="no" className="text-sm leading-relaxed">
              {chosen.consequence}
            </p>
          </div>
          <div className="flex gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 sm:p-4">
            <EvoAvatar decorative className="size-10 shrink-0 sm:size-11" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {t("EVO explains")}
              </p>
              <p translate="no" className="text-sm leading-relaxed">
                {chosen.feedback}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="min-h-11 w-full sm:w-auto"
              size="sm"
              variant="outline"
              onClick={retry}
            >
              <RotateCcw className="size-4" aria-hidden="true" /> {t("Try another approach")}
            </Button>
            {!completed && (
              <Button className="min-h-11 w-full sm:w-auto" size="sm" onClick={finish}>
                <Zap className="size-4" aria-hidden="true" />
                {t("Complete challenge")}
              </Button>
            )}
          </div>
          {completed && (
            <p className="flex items-center gap-2 text-sm font-medium text-brand-green">
              <CheckCircle2 className="size-4" aria-hidden="true" />{" "}
              {t("Challenge completed. Your lesson score is unchanged.")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

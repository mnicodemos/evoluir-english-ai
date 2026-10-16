import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Crown,
  Flower2,
  Languages,
  Loader2,
  Play,
  Square,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { LifeSectionTitle, useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { useLife } from "@/hooks/useLife";
import { useProfile } from "@/hooks/useProfile";
import { logPracticeTelemetry } from "@/lib/legacyActivity.functions";
import {
  MEDITATION_RATE,
  MEDITATIONS,
  meditationMinutes,
  meditationTier,
  type MeditationSession,
} from "@/lib/meditations";
import { prepareSpeech, speakEnglish, stopSpeaking } from "@/lib/speech";
import { cn } from "@/lib/utils";

type Phase = "list" | "playing" | "done";

/**
 * Meditations in English inside Life+ AI (meditations.ts): EVO reads a short
 * guided session line by line, slowly, with the text on screen (Portuguese
 * on request); the minutes count toward the day's goal (activity
 * "meditation"). Calm breathing is free; the other sessions are Premium.
 */
export function MeditationSection() {
  const { t } = useLifeT();
  const { data: profile } = useProfile();
  const { data: life } = useLife();
  const logMinutes = useServerFn(logPracticeTelemetry);
  const tier = meditationTier(profile?.level);
  const rate = MEDITATION_RATE[tier];

  const [session, setSession] = useState<MeditationSession | null>(null);
  const [phase, setPhase] = useState<Phase>("list");
  const [current, setCurrent] = useState(-1);
  const [showPt, setShowPt] = useState(false);
  const run = useRef(0);
  const startedAt = useRef(0);
  const logged = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const donePanel = useRef<HTMLDivElement>(null);

  // Keep the line being read in view inside the block, without moving the page.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const target =
      phase === "done"
        ? donePanel.current
        : box.querySelector<HTMLElement>(`[data-line="${current}"]`);
    if (target) box.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: "smooth" });
  }, [current, phase]);

  const saveMinutes = () => {
    if (logged.current || !startedAt.current) return;
    const minutes = Math.round((Date.now() - startedAt.current) / 60_000);
    if (minutes < 1) return;
    logged.current = true;
    void logMinutes({
      data: { operationKey: crypto.randomUUID(), activityType: "meditation", minutes },
    }).catch(() => undefined);
  };

  // Leaving the screen stops the voice and keeps the minutes already done.
  useEffect(
    () => () => {
      run.current += 1;
      stopSpeaking();
      saveMinutes();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function play(chosen: MeditationSession) {
    const id = ++run.current;
    const lines = chosen.lines[tier];
    setSession(chosen);
    setPhase("playing");
    setCurrent(-1);
    startedAt.current = Date.now();
    logged.current = false;
    for (let index = 0; index < lines.length; index += 1) {
      if (run.current !== id) return;
      setCurrent(index);
      const next = lines[index + 1];
      if (next) prepareSpeech(next.en, { cache: "persistent" });
      try {
        await speakEnglish(lines[index]!.en, { cache: "persistent", rate });
      } catch {
        if (run.current !== id) return;
        toast.error(t("Audio is unavailable right now."));
        stop();
        return;
      }
      if (run.current !== id) return;
      await new Promise((resolve) => setTimeout(resolve, lines[index]!.pause * 1000));
    }
    if (run.current !== id) return;
    setPhase("done");
    saveMinutes();
  }

  function stop() {
    run.current += 1;
    stopSpeaking();
    saveMinutes();
    setPhase("list");
    setSession(null);
    setCurrent(-1);
  }

  const premium = !!life?.premium;

  if (session && phase !== "list") {
    const lines = session.lines[tier];
    return (
      <section
        id="meditation"
        className="card-soft scroll-mt-4 p-4 sm:p-5 xl:p-6"
        aria-labelledby="meditation-title"
      >
        {/* Stop sits on top and the text scrolls inside the block (user
            request), so a session never makes the one page grow. */}
        <LifeSectionTitle
          id="meditation-title"
          icon={Flower2}
          accent="rose"
          title={t(session.title)}
        >
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              aria-pressed={showPt}
              onClick={() => setShowPt((value) => !value)}
            >
              <Languages className="size-3.5" aria-hidden="true" />
              {showPt ? t("Hide translation") : t("Show translation")}
            </Button>
            {phase === "playing" ? (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={stop}>
                <Square className="size-3.5" aria-hidden="true" />
                {t("Stop")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={stop}>
                {t("Back to meditations")}
              </Button>
            )}
          </div>
        </LifeSectionTitle>

        <div ref={scroller} className="relative mt-3 max-h-56 overflow-y-auto pr-1">
          <ol className="space-y-2" translate="no">
            {lines.map((line, index) => (
              <li
                key={line.en}
                data-line={index}
                className={cn(
                  "rounded-lg p-2 text-sm transition-colors",
                  index === current && phase === "playing"
                    ? "bg-brand-green/12 text-foreground"
                    : index < current || phase === "done"
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                <span className="flex items-start gap-2">
                  {index === current && phase === "playing" ? (
                    <Volume2
                      className="mt-0.5 size-4 shrink-0 text-brand-green"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{line.en}</span>
                </span>
                {showPt ? <span className="mt-0.5 block text-xs italic">{line.pt}</span> : null}
              </li>
            ))}
          </ol>

          {phase === "done" ? (
            <div ref={donePanel} className="mt-3 space-y-3 rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-green">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t("Session complete")}
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Key words")}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5" translate="no">
                  {session.words.map(([word, meaning]) => (
                    <li key={word}>
                      <button
                        type="button"
                        onClick={() =>
                          void speakEnglish(word, { cache: "persistent" }).catch(() => undefined)
                        }
                        className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-secondary"
                      >
                        <span className="font-medium">{word}</span>{" "}
                        <span className="text-muted-foreground">· {meaning}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Think about it")}
                </p>
                <p className="mt-1 text-sm" translate="no">
                  {session.reflection}
                </p>
              </div>
              <Button
                asChild
                size="sm"
                className="bg-brand-green text-sidebar hover:bg-brand-green/90"
              >
                <Link to="/teacher">{t("Answer it with the AI Teacher")}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      id="meditation"
      className="card-soft scroll-mt-4 p-4 sm:p-5 xl:p-6"
      aria-labelledby="meditation-title"
    >
      <LifeSectionTitle
        id="meditation-title"
        icon={Flower2}
        accent="rose"
        title={t("Meditations in English")}
        subtitle={t(
          "Relax and train your listening: EVO guides you slowly, with the text on screen.",
        )}
      />
      {/* Side by side in the wide row under Routine and the Life Coach. */}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {MEDITATIONS.map((item) => {
          const locked = !item.free && !premium;
          const minutes = meditationMinutes(item.lines[tier], rate);
          return (
            <li key={item.id}>
              {locked ? (
                <Link
                  to="/premium"
                  aria-label={`${t(item.title)} · Premium`}
                  className="flex items-center gap-3 rounded-lg bg-secondary/30 p-2.5 text-sm opacity-60 hover:opacity-80"
                >
                  <Crown className="size-4 shrink-0 text-amber-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(item.title)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {`${t(item.when)} · ${minutes} min`}
                    </span>
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void play(item)}
                  className="flex w-full items-center gap-3 rounded-lg bg-secondary/60 p-2.5 text-left text-sm hover:bg-secondary"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green">
                    {phase === "playing" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(item.title)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {`${t(item.when)} · ${minutes} min`}
                    </span>
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

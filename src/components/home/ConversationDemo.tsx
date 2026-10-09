import { Check, Mic, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { EvoAvatar } from "@/components/EvoAvatar";

/**
 * Public home: an animated example of an AI Speaking turn (EVO asks, the
 * student answers by voice, EVO recasts and points out the fix). It is an
 * illustration built in code, labelled as an example, not a recording. With
 * reduced motion the whole exchange is shown at once.
 */
const TIMELINE = [0, 1600, 3000, 4600, 7400, 9000] as const;
const LOOP_MS = 12_000;

export function ConversationDemo() {
  const [step, setStep] = useState(TIMELINE.length - 1);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      timers = TIMELINE.map((at, index) => setTimeout(() => setStep(index), at));
      timers.push(setTimeout(run, LOOP_MS));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, []);

  // Messages enter from the bottom like a real chat: not-yet-said lines take
  // no space, and each one fades in when its turn comes.
  const show = (index: number) =>
    step >= index
      ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-500"
      : "hidden";
  const listening = step === 1;

  return (
    <div className="card-soft overflow-hidden" aria-label="Exemplo de conversa com a EVO">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <EvoAvatar decorative className="size-10 sm:size-10" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">EVO</p>
          <p className="text-xs text-success">
            {step === 0 || step === 3 ? "falando…" : listening ? "ouvindo você…" : "online"}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Exemplo
        </span>
      </div>

      <div
        className="flex h-[21rem] flex-col justify-end gap-2.5 p-4 text-sm"
        translate="no"
        aria-live="off"
      >
        <p
          className={`max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5 ${show(0)}`}
        >
          Hi! What did you do last weekend?
        </p>

        <div
          className={`ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-success/15 px-3.5 py-2.5 ${show(2)}`}
        >
          I <span className="rounded bg-warning/25 px-0.5 text-warning">go</span> to the beach with
          my friends.
        </div>

        <div className={`max-w-[85%] ${show(3)}`}>
          <p className="rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5">
            Nice! You <strong className="text-success">went</strong> to the beach. Which beach did
            you go to?
          </p>
          <p
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success"
            translate="yes"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            go → went: no passado, use went
          </p>
        </div>

        <div className={`ml-auto flex max-w-[85%] flex-col items-end ${show(4)}`}>
          <p className="rounded-2xl rounded-br-sm bg-success/15 px-3.5 py-2.5">
            I went to Ipanema!
          </p>
          <p
            className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-success transition-opacity duration-500 ${step >= 5 ? "opacity-100" : "opacity-0"}`}
            translate="yes"
          >
            <Check className="size-3.5" aria-hidden="true" />
            Correto!
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-3">
        <span
          className={`grid size-11 place-items-center rounded-full border-2 transition-colors ${
            listening || step === 4
              ? "border-success bg-success/20 text-success"
              : "border-border text-muted-foreground"
          }`}
          aria-hidden="true"
        >
          <Mic className="size-5" />
        </span>
        <span className="flex h-6 items-center gap-1" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
            <span
              key={bar}
              className={`w-1 rounded-full bg-success transition-all duration-300 motion-safe:animate-pulse ${
                listening || step === 4 ? "opacity-100" : "opacity-25"
              }`}
              style={{
                height: listening || step === 4 ? `${[40, 75, 55, 100, 60, 85, 45][bar]}%` : "20%",
                animationDelay: `${bar * 120}ms`,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { GripHorizontal, Maximize2, Minus, Pause, Play, Square, X } from "lucide-react";
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { TomatoIcon } from "@/components/focus/TomatoIcon";
import { useLifeT } from "@/components/life/LifeNav";
import { Button } from "@/components/ui/button";
import { addFocusLog } from "@/hooks/useFocusLog";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import {
  closeFocusWidget,
  focusCompleteDue,
  focusPause,
  focusResume,
  focusSetPreset,
  focusSkipBreak,
  focusStart,
  focusStop,
  minimizeFocusWidget,
  moveFocusWidget,
  type FocusState,
} from "@/lib/focusTimer";
import { haptic } from "@/lib/haptics";
import { FOCUS_PRESET_IDS, FOCUS_PRESETS, focusClock } from "@/lib/life";
import { graphitePanelClass } from "@/lib/surfaces";
import { studyToday } from "@/lib/today";
import { cn } from "@/lib/utils";

/** A soft two-note chime when a phase ends; silent where audio is blocked. */
function chime() {
  try {
    const context = new AudioContext();
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.22;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.55);
    });
    window.setTimeout(() => void context.close().catch(() => undefined), 1500);
  } catch {
    // No audio: the vibration and the toast are enough.
  }
}

function focusPhaseLabel(state: FocusState) {
  return state.phase === "break" ? "Break" : state.phase === "focus" ? "Focus" : "Ready";
}

/**
 * Mounted once by AppShell on every page: ends each Focus phase when its time
 * is up (logs the block, chime, vibration, toast), shows the countdown in the
 * tab title, and draws the floating window when it is open (user request: the
 * student keeps studying while the timer runs, and can minimize, move or close
 * the window; closing it never stops the timer).
 */
export function FocusController() {
  const { t } = useLifeT();
  const { state, widget, now } = useFocusTimer();

  useEffect(() => {
    const ended = focusCompleteDue(Date.now());
    if (!ended) return;
    chime();
    if (ended.kind === "focus") {
      addFocusLog({
        day: studyToday(new Date(ended.endedAt)),
        minutes: ended.minutes,
        key: ended.key,
      });
      haptic("success");
      toast.success(t("Focus block done! Time for a break."));
    } else {
      haptic("tap");
      toast(t("Break over. Ready for the next focus block?"));
    }
  }, [now, state, t]);

  useEffect(() => {
    if (state.phase === "idle" || state.endsAt === null) return;
    const original = document.title;
    document.title = `${state.phase === "focus" ? "🍅" : "☕"} ${focusClock(state.endsAt - now)} · Evoluir+`;
    return () => {
      document.title = original;
    };
  }, [state.phase, state.endsAt, now]);

  return widget.open ? <FocusWidget /> : null;
}

const MARGIN = 8;

function FocusWidget() {
  const { t } = useLifeT();
  const { state, widget, view } = useFocusTimer();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; x: number; y: number } | null>(null);

  // Kept inside the screen when it turns or shrinks.
  useEffect(() => {
    const keepInside = () => {
      const element = box.current;
      if (!element || widget.x === null || widget.y === null) return;
      const x = Math.min(
        Math.max(MARGIN, widget.x),
        window.innerWidth - element.offsetWidth - MARGIN,
      );
      const y = Math.min(
        Math.max(MARGIN, widget.y),
        window.innerHeight - element.offsetHeight - MARGIN,
      );
      if (x !== widget.x || y !== widget.y) moveFocusWidget(x, y);
    };
    keepInside();
    window.addEventListener("resize", keepInside);
    return () => window.removeEventListener("resize", keepInside);
  }, [widget.x, widget.y, widget.minimized]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button,a")) return;
    const element = box.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    drag.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      x: rect.left,
      y: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const element = box.current;
    if (!drag.current || !element) return;
    const x = Math.min(
      Math.max(MARGIN, event.clientX - drag.current.dx),
      window.innerWidth - element.offsetWidth - MARGIN,
    );
    const y = Math.min(
      Math.max(MARGIN, event.clientY - drag.current.dy),
      window.innerHeight - element.offsetHeight - MARGIN,
    );
    drag.current = { ...drag.current, x, y };
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
  };
  const onPointerUp = () => {
    if (drag.current) moveFocusWidget(drag.current.x, drag.current.y);
    drag.current = null;
  };

  const placed = widget.x !== null && widget.y !== null;
  const dragProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    className: "cursor-grab touch-none select-none active:cursor-grabbing",
  };
  const clock = focusClock(view.leftMs);
  const tone = state.phase === "break" ? "bg-brand-green" : "bg-pink-400";

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={t("Focus timer")}
      style={placed ? { left: widget.x!, top: widget.y! } : undefined}
      className={cn(
        "dashboard-shell dark fixed z-50 rounded-2xl",
        graphitePanelClass,
        !placed && "bottom-[5.25rem] right-4 lg:bottom-6 lg:right-6",
        widget.minimized ? "w-auto" : "w-[17rem]",
      )}
    >
      {widget.minimized ? (
        // Minimized: one pill with the clock, still draggable.
        <div className="flex items-center gap-1 p-1 pl-1.5">
          <div
            {...dragProps}
            className={cn(dragProps.className, "flex items-center gap-2 py-1 pl-1 pr-1.5")}
          >
            <span
              className={cn("size-2 rounded-full", state.phase === "idle" ? "bg-white/30" : tone)}
            />
            <span className="font-display text-sm font-bold tabular-nums">
              {state.phase === "idle" ? t("Focus") : clock}
            </span>
          </div>
          {state.phase !== "idle" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              aria-label={view.running ? t("Pause") : t("Resume")}
              onClick={view.running ? focusPause : focusResume}
            >
              {view.running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            aria-label={t("Expand")}
            onClick={() => minimizeFocusWidget(false)}
          >
            <Maximize2 aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            aria-label={t("Close")}
            onClick={closeFocusWidget}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <>
          <div
            {...dragProps}
            className={cn(
              dragProps.className,
              "flex items-center gap-2 border-b border-white/10 py-1.5 pl-3 pr-1.5",
            )}
          >
            <TomatoIcon className="size-4 shrink-0 text-red-400" />
            <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t(focusPhaseLabel(state))}
            </span>
            <GripHorizontal className="size-4 text-white/30" aria-hidden="true" />
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              aria-label={t("Minimize")}
              onClick={() => minimizeFocusWidget(true)}
            >
              <Minus aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              aria-label={t("Close")}
              onClick={closeFocusWidget}
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <div className="space-y-3 p-3">
            <div>
              <p className="text-center font-display text-4xl font-bold tabular-nums" role="timer">
                {clock}
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                aria-hidden="true"
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", tone)}
                  style={{ width: `${Math.round(view.share * 100)}%` }}
                />
              </div>
            </div>

            {state.phase === "idle" ? (
              <div
                className="flex justify-center gap-1"
                role="group"
                aria-label={t("Block length")}
              >
                {FOCUS_PRESET_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={state.preset === id}
                    onClick={() => focusSetPreset(id)}
                    className={cn(
                      "h-7 rounded-full border px-2.5 text-[11px] font-medium tabular-nums transition-colors",
                      state.preset === id
                        ? "border-pink-400/50 bg-pink-400/12 text-pink-300"
                        : "border-white/10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {`${FOCUS_PRESETS[id].focus} / ${FOCUS_PRESETS[id].shortBreak}`}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex gap-2">
              {state.phase === "idle" ? (
                <Button
                  onClick={() => {
                    haptic("tap");
                    focusStart();
                  }}
                  className="h-9 flex-1 gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
                >
                  <Play aria-hidden="true" />
                  {t("Start focus")}
                </Button>
              ) : (
                <>
                  {view.running ? (
                    <Button variant="outline" onClick={focusPause} className="h-9 flex-1 gap-1.5">
                      <Pause aria-hidden="true" />
                      {t("Pause")}
                    </Button>
                  ) : (
                    <Button
                      onClick={focusResume}
                      className="h-9 flex-1 gap-1.5 bg-brand-green text-sidebar hover:bg-brand-green/90"
                    >
                      <Play aria-hidden="true" />
                      {t("Resume")}
                    </Button>
                  )}
                  {state.phase === "break" ? (
                    <Button variant="ghost" onClick={focusSkipBreak} className="h-9">
                      {t("Skip break")}
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={focusStop} className="h-9 gap-1.5">
                      <Square aria-hidden="true" />
                      {t("Stop")}
                    </Button>
                  )}
                </>
              )}
            </div>

            <Link
              to="/life"
              hash="focus"
              className="block text-center text-[11px] font-medium text-brand-green hover:underline"
            >
              {t("Open Focus in Life+ AI")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

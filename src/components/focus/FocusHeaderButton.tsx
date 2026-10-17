import { TomatoIcon } from "@/components/focus/TomatoIcon";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { openFocusWidget } from "@/lib/focusTimer";
import { focusClock } from "@/lib/life";
import { cn } from "@/lib/utils";

/**
 * Opens the floating Focus timer from the Dashboard header capsule, beside
 * Weather talk (user request: the same pill pattern, phones included), marked
 * with a red tomato, the Pomodoro symbol (user request). While a phase runs a
 * dot shows on phones (pink while focusing, green in the break) and the time
 * left shows beside it on desktop.
 */
export function FocusHeaderButton({
  translate: t,
  placement,
}: {
  translate: (label: string) => string;
  placement: "desktop" | "mobile";
}) {
  const { state, view } = useFocusTimer();
  const active = state.phase !== "idle";
  const tone = state.phase === "break" ? "text-brand-green" : "text-pink-400";
  const label = active
    ? `${t("Floating timer")} · ${focusClock(view.leftMs)}`
    : t("Floating timer");

  if (placement === "mobile") {
    return (
      <button
        type="button"
        onClick={openFocusWidget}
        aria-label={label}
        title={label}
        className="relative grid size-8 shrink-0 place-items-center rounded-full text-slate-100 transition-colors hover:bg-white/10 hover:text-white"
      >
        <TomatoIcon className="size-5" />
        {active ? (
          <span
            className={cn(
              "absolute right-1 top-1 size-2 rounded-full ring-2 ring-background",
              state.phase === "break" ? "bg-brand-green" : "bg-pink-400",
            )}
            aria-hidden="true"
          />
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openFocusWidget}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors hover:bg-white/10",
        active ? tone : "text-muted-foreground hover:text-foreground",
      )}
    >
      <TomatoIcon className="size-[1.15rem]" />
      {active ? (
        <span className="font-display text-sm font-semibold tabular-nums">
          {focusClock(view.leftMs)}
        </span>
      ) : null}
    </button>
  );
}

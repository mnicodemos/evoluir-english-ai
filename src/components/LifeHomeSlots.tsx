import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeftRight,
  Check,
  Crown,
  ListChecks,
  Plus,
  Repeat,
  Search,
  Target,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLife } from "@/hooks/useLife";
import { habitsDueToday, type LifeHabit, type LifeTask } from "@/lib/life";
import { setLifeHabitDone, setLifeTaskDone } from "@/lib/life.functions";
import { graphitePanelClass } from "@/lib/surfaces";
import { cn } from "@/lib/utils";

type T = (label: string) => string;
type LifeData = NonNullable<ReturnType<typeof useLife>["data"]>;

export type HomeChoice = { goal?: string; task?: string; habit?: string };

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/**
 * Which goal, task and habit the Dashboard's Life+ AI card shows (user request:
 * one of each, the student picks which when there are more). Kept in this
 * browser per student; read after mount so server and client agree.
 */
export function useHomeChoice(userId: string | undefined) {
  const key = userId ? `evoluir-life-home:${userId}` : null;
  const [choice, setChoice] = useState<HomeChoice>({});
  useEffect(() => {
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      setChoice(raw ? (JSON.parse(raw) as HomeChoice) : {});
    } catch {
      setChoice({});
    }
  }, [key]);
  const choose = (kind: keyof HomeChoice, id: string) => {
    setChoice((current) => {
      const next = { ...current, [kind]: id };
      if (key) {
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage blocked: the choice lasts until the page is left.
        }
      }
      return next;
    });
  };
  return { choice, choose };
}

/** Today's tasks, open ones first and by priority. */
export function tasksToday(life: LifeData): LifeTask[] {
  return life.tasks
    .filter((task) => task.day === life.today)
    .sort(
      (a, b) =>
        Number(!!a.doneAt) - Number(!!b.doneAt) ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
}

export function habitsToday(life: LifeData): LifeHabit[] {
  return habitsDueToday(life.habits, life.logs, life.today);
}

export function habitDoneToday(life: LifeData, habitId: string) {
  return life.logs.some((log) => log.habitId === habitId && log.day === life.today);
}

/** The picked item, or the first one when nothing (or a removed item) was picked. */
export function pick<Item extends { id: string }>(items: readonly Item[], id: string | undefined) {
  return items.find((item) => item.id === id) ?? items[0] ?? null;
}

/** Ticks a task or checks in a habit right on the Dashboard. */
export function useLifeActions(t: T) {
  const queryClient = useQueryClient();
  const setTask = useServerFn(setLifeTaskDone);
  const setHabit = useServerFn(setLifeHabitDone);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["life"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  };
  const task = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setTask({ data: input }),
    onSuccess: refresh,
    onError: () => toast.error(t("The task could not be saved.")),
  });
  const habit = useMutation({
    mutationFn: (input: { habitId: string; day: string; done: boolean }) =>
      setHabit({ data: input }),
    onSuccess: refresh,
    onError: () => toast.error(t("The habit could not be saved.")),
  });
  return { task, habit };
}

/** A round check, sized like the Rhythm card's day marks: grey and empty while open, teal with its check once done. */
export function DoneCheck({
  done,
  disabled,
  label,
  onToggle,
}: {
  done: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        // The same size as the day marks of Your learning rhythm (user request).
        "grid size-5 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50",
        done
          ? "border-brand-green bg-brand-green text-primary-foreground"
          : "border-muted-foreground text-muted-foreground hover:border-brand-green hover:text-brand-green",
      )}
    >
      <Check className={cn("size-3", !done && "opacity-0")} strokeWidth={3} aria-hidden="true" />
    </button>
  );
}

/** "Choose what shows here": opens the list when there is more than one. */
export function SlotChooser<Item extends { id: string; title: string }>({
  items,
  current,
  onChoose,
  t,
}: {
  items: readonly Item[];
  current: string | undefined;
  onChoose: (id: string) => void;
  t: T;
}) {
  const [open, setOpen] = useState(false);
  if (items.length < 2) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Choose what shows here")}
          title={t("Choose what shows here")}
          className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
        >
          <ArrowLeftRight className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className={cn(
          "dashboard-shell dark w-[min(18rem,calc(100vw-2rem))] p-2",
          graphitePanelClass,
        )}
      >
        <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-brand-green">
          {t("Choose what shows here")}
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onChoose(item.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10",
                  item.id === current && "text-brand-green",
                )}
              >
                <span className="min-w-0 flex-1 truncate" translate="no">
                  {item.title}
                </span>
                {item.id === current ? (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** One slot of the card: a kind label, the item and its action row. */
export function LifeSlot({
  kind,
  icon,
  title,
  done,
  badge,
  details,
  chooser,
  action,
}: {
  kind: string;
  icon: ReactNode;
  title: string;
  done: boolean;
  badge?: ReactNode;
  details: ReactNode;
  chooser: ReactNode;
  action: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Two rows (user request: the card as tall as the level card): the kind with
  // the chooser and magnifier, then the item with its check on the same line.
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col justify-between gap-0.5 rounded-lg px-2.5 py-1.5 transition-colors",
        done ? "bg-brand-green/10 ring-1 ring-brand-green/30" : "bg-secondary/60",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {icon}
          {kind}
        </p>
        {chooser}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={kind}
              title={kind}
              className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60"
            >
              <Search className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={8}
            className={cn(
              "dashboard-shell dark w-[min(22rem,calc(100vw-2rem))] space-y-3 p-4",
              graphitePanelClass,
            )}
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold text-brand-green">{kind}</p>
              <h3 className="text-base font-semibold leading-snug" translate="no">
                {title}
              </h3>
            </div>
            {details}
            <div className="flex justify-end">{action}</div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 line-clamp-2 text-xs font-semibold leading-snug",
            done && "text-muted-foreground line-through",
          )}
          translate="no"
        >
          {title}
        </p>
        {/* The task's urgency sits beside its check (user request). */}
        {badge}
        {action}
      </div>
    </li>
  );
}

/** A free slot: the way to add the first task or habit, or Premium's crown. */
export function EmptySlot({
  kind,
  text,
  to,
  hash,
  premium,
}: {
  kind: string;
  text: string;
  to: "/life" | "/premium";
  hash?: string;
  premium?: boolean;
}) {
  return (
    <li className="min-w-0">
      <Link
        to={to}
        {...(hash ? { hash } : {})}
        className={cn(
          "flex h-full min-w-0 flex-col justify-center gap-0.5 rounded-lg border border-dashed border-border px-3 py-1.5 transition-colors hover:border-brand-green/50 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60",
          premium && "opacity-70",
        )}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          {premium ? (
            <Crown className="size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          ) : (
            <span
              className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-green/15 text-brand-green"
              aria-hidden="true"
            >
              <Plus className="size-3" strokeWidth={3} />
            </span>
          )}
          {kind}
        </span>
        <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{text}</span>
      </Link>
    </li>
  );
}

export const SLOT_ICONS = {
  goal: <Target className="size-3" aria-hidden="true" />,
  task: <ListChecks className="size-3" aria-hidden="true" />,
  habit: <Repeat className="size-3" aria-hidden="true" />,
};

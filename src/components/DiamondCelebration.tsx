import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Flame, Gem, MessageCircle, BookOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CelebrationBurst } from "@/components/CelebrationBurst";
import { EvoAvatar } from "@/components/EvoAvatar";
import { JEWELS } from "@/components/LeagueBadge";
import { CopyButton, WhatsAppButton } from "@/components/ShareActions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { DIAMOND_DAYS, diamondName, diamondShareText } from "@/lib/diamondCycles";
import { haptic } from "@/lib/haptics";
import { graphitePanelClass } from "@/lib/surfaces";
import { cn } from "@/lib/utils";
import { LEARNED_MASTERY } from "@/lib/vocabularyReview";

const DIAMOND_COLOR = JEWELS[JEWELS.length - 1]!.color;

type CountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq: (column: string, value: unknown) => CountQuery;
  gte: (column: string, value: unknown) => CountQuery;
};

/** A plain row count (head: true); null when the read fails. */
async function countRows(
  table: string,
  build: (query: CountQuery) => CountQuery,
): Promise<number | null> {
  const from = supabase.from.bind(supabase) as unknown as (name: string) => {
    select: (columns: string, options: { count: "exact"; head: true }) => CountQuery;
  };
  const { count, error } = await build(from(table).select("*", { count: "exact", head: true }));
  return error ? null : (count ?? 0);
}

/**
 * The moment the student reaches the Diamond, and each later Diamond cycle
 * (owner decision, 2026-10-31): once per level on this device
 * (evoluir-diamond-celebrated:<id>:<level>), EVO sums up the journey (days in
 * a row, study days, conversations, words learned, level) with sparks, and the
 * student can share the achievement on WhatsApp or copy it.
 */
export function DiamondCelebration({
  userId,
  level,
  streakDays,
  englishLevel,
  lang,
  translate,
}: {
  userId: string;
  /** 0 = no Diamond yet; 1 = the Diamond; 2+ = Diamond cycles. */
  level: number;
  streakDays: number;
  englishLevel: string | null;
  lang: "pt" | "en";
  translate: (label: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (level < 1) return;
    const key = `evoluir-diamond-celebrated:${userId}:${level}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setOpen(true);
    setBurst(true);
    haptic("success");
    const timer = window.setTimeout(() => setBurst(false), 1600);
    return () => window.clearTimeout(timer);
  }, [userId, level]);

  const { data: journey } = useQuery({
    queryKey: ["diamond-journey", userId],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const [studyDays, conversations, wordsLearned] = await Promise.all([
        countRows("study_days", (query) => query.eq("user_id", userId)),
        countRows("activities", (query) =>
          query.eq("user_id", userId).eq("activity_type", "conversation"),
        ),
        countRows("user_vocabulary", (query) =>
          query.eq("user_id", userId).gte("mastery_level", LEARNED_MASTERY),
        ),
      ]);
      return { studyDays, conversations, wordsLearned };
    },
  });

  if (level < 1) return null;
  const name = diamondName(level, lang);
  const shareText = diamondShareText(
    {
      level,
      streakDays,
      studyDays: journey?.studyDays ?? null,
      conversations: journey?.conversations ?? null,
      wordsLearned: journey?.wordsLearned ?? null,
      englishLevel,
    },
    lang,
  );
  const stats: { icon: ReactNode; value: number | string | null | undefined; label: string }[] = [
    { icon: <Flame className="size-4" />, value: streakDays, label: "days in a row" },
    { icon: <CalendarCheck className="size-4" />, value: journey?.studyDays, label: "study days" },
    {
      icon: <MessageCircle className="size-4" />,
      value: journey?.conversations,
      label: "conversations with EVO",
    },
    { icon: <BookOpen className="size-4" />, value: journey?.wordsLearned, label: "words learned" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        overlayClassName="bg-black/40"
        className={cn(
          "dashboard-shell dark w-[calc(100vw-2rem)] max-w-md rounded-3xl p-6 text-center",
          graphitePanelClass,
        )}
      >
        <div className="relative mx-auto grid size-20 place-items-center">
          <CelebrationBurst active={burst} />
          <span
            className="grid size-20 place-items-center rounded-full"
            style={{ backgroundColor: `color-mix(in oklab, ${DIAMOND_COLOR} 16%, transparent)` }}
            aria-hidden="true"
          >
            <Gem className="size-10" style={{ color: DIAMOND_COLOR }} strokeWidth={2.2} />
          </span>
        </div>
        <DialogTitle className="mt-2 font-display text-2xl font-bold">{name}!</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {level >= 2 ? (
            <>
              <span>{DIAMOND_DAYS * level}</span>{" "}
              <span>{translate("days in a row. Another Diamond cycle is yours for good.")}</span>
            </>
          ) : (
            translate("63 days in a row: the last jewel is yours for good.")
          )}
        </DialogDescription>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
          <EvoAvatar decorative className="size-10 sm:size-10" />
          <p className="text-sm leading-snug">
            {translate("Look how far you have come. I am proud of you!")}
          </p>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-2 text-left">
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2"
            >
              <span className="text-brand-green" aria-hidden="true">
                {stat.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold leading-tight">
                  {stat.value ?? "—"}
                </span>
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {translate(stat.label)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-muted-foreground">
          {translate("Every 63 more days in a row adds another Diamond cycle.")}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
          <WhatsAppButton text={shareText} label="Share achievement" />
          <CopyButton text={shareText} />
        </div>
        <Button className="mt-3 w-full" onClick={() => setOpen(false)}>
          {translate("Keep going")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

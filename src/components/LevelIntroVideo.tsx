import { useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  FileText,
  Flag,
  Headphones,
  PlayCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/usePersistentState";
import { supabase } from "@/integrations/supabase/client";
import { findLevel } from "@/lib/level";
import { vimeoEmbedUrl } from "@/lib/lessonVideoDisplay";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/** The Vimeo player without its own title, byline and portrait (the card names the level). */
function cleanPlayerUrl(embed: string): string {
  const url = new URL(embed);
  url.searchParams.set("title", "0");
  url.searchParams.set("byline", "0");
  url.searchParams.set("portrait", "0");
  url.searchParams.set("dnt", "1");
  return url.toString();
}

/** What the level holds, beside the video (the same facts as the path and the guide). */
const LEVEL_FACTS = [
  { icon: BookOpenCheck, text: "30 core lessons in 5 units, plus a review unit" },
  { icon: Headphones, text: "Each lesson: audio with EVO and Leo, summary, cards and quiz" },
  { icon: Flag, text: "The Final Test opens after 21 lessons; 70% moves you up" },
] as const;
const BUSINESS_FACTS = [
  { icon: BookOpenCheck, text: "36 lessons in 6 units, written at your level" },
  { icon: Headphones, text: "Each lesson: audio with EVO and Leo, summary, cards and quiz" },
  { icon: FileText, text: "Download each unit as a PDF workbook" },
] as const;

/**
 * "Start here": the level's presentation video on top of the learning path
 * and of Business English (owner request, 2026-10-31: one video per level,
 * set in Admin → Content). Desktop: the video at about 60% of the card with
 * the level's panel beside it (owner request: full width pushed the path off
 * the screen); phones stack them. Open until the student marks it watched,
 * then one row that opens it again. Optional: it never counts toward the
 * checklist, the study day or the Final Test. Nothing shows while no video is
 * set (or before migration 0097 is applied).
 */
export function LevelIntroVideo({
  level,
  label,
  userId,
}: {
  /** "a1" to "c2", or "business". */
  level: string;
  /** What the student sees: "A1", "Business English". */
  label: string;
  userId?: string | undefined;
}) {
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
  const { data: url } = useQuery({
    queryKey: ["level-intro-video", level],
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("level_intro_videos")
        .select("video_url")
        .eq("level", level)
        .maybeSingle();
      return error ? null : (data?.video_url ?? null);
    },
  });
  const [seen, setSeen] = usePersistentState<boolean>(
    `evoluir-level-intro-seen:${userId ?? "guest"}:${level}`,
    false,
  );
  const [open, setOpen] = usePersistentState<boolean>(
    `evoluir-level-intro-open:${userId ?? "guest"}:${level}`,
    false,
  );
  const embed = vimeoEmbedUrl(url);
  if (!embed) return null;
  const showPlayer = !seen || open;
  const business = level === "business";
  const facts = business ? BUSINESS_FACTS : LEVEL_FACTS;
  const subtitle = business ? t("English for work") : findLevel(level).hint;

  if (!showPlayer) {
    return (
      <button
        type="button"
        className="card-soft flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-white/[0.03]"
        onClick={() => setOpen(true)}
        aria-expanded={false}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-green/15 text-brand-green">
          <PlayCircle className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">
          <span>{t("Level presentation")}</span> · <span>{label}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section
      className="card-soft relative overflow-hidden p-3 sm:p-4"
      aria-label={t("Level presentation")}
    >
      {/* A soft brand glow behind the panel: the one premium touch, flat colours elsewhere. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-green/10 blur-3xl"
      />
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)] lg:items-center lg:gap-6">
        <div className="overflow-hidden rounded-xl bg-black shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
          <iframe
            className="aspect-video w-full"
            src={cleanPlayerUrl(embed)}
            title={t("Level presentation")}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
          />
        </div>
        <div className="min-w-0 space-y-3 lg:py-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-green">
              {seen ? t("Level presentation") : t("Start here")}
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold sm:text-2xl">
              <span>{t("Welcome to")}</span> <span>{label}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(subtitle)}</p>
          </div>
          <ul className="space-y-2">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-brand-green">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="text-foreground/85">{t(text)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {seen ? (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setOpen(false)}>
                <ChevronDown className="size-4 rotate-180" aria-hidden="true" />
                {t("Hide video")}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setSeen(true);
                    setOpen(false);
                  }}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t("I watched it")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t("Optional: watch it whenever you like.")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

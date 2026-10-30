import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/usePersistentState";
import { supabase } from "@/integrations/supabase/client";
import { vimeoEmbedUrl } from "@/lib/lessonVideoDisplay";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

/**
 * "Start here": the level's presentation video on top of the learning path
 * and of Business English (owner request, 2026-10-31: one video per level,
 * set in Admin → Content). Open until the student marks it watched, then one
 * row that opens it again. Optional: it never counts toward the checklist, the
 * study day or the Final Test. Nothing shows while no video is set (or before
 * migration 0097 is applied).
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

  return (
    <section className="card-soft overflow-hidden p-3 sm:p-4" aria-label={t("Level presentation")}>
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        onClick={() => (seen ? setOpen(!open) : undefined)}
        aria-expanded={showPlayer}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-green/15 text-brand-green">
          <PlayCircle className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-brand-green">
            {seen ? t("Level presentation") : t("Start here")}
          </span>
          <span className="font-display block truncate text-sm font-semibold sm:text-base">
            <span>{t("Welcome to")}</span> <span>{label}</span>
          </span>
        </span>
        {seen && (
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${showPlayer ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        )}
      </button>
      {showPlayer && (
        <div className="mt-3 space-y-3">
          <div className="overflow-hidden rounded-xl bg-black">
            <iframe
              className="aspect-video w-full"
              src={embed}
              title={t("Level presentation")}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          </div>
          {!seen && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => {
                  setSeen(true);
                  setOpen(false);
                }}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t("I watched it")}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

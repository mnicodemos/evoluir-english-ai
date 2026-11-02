import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Clapperboard, Crown, Layers, Lock, PlayCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExtraVideosNews } from "@/hooks/useExtraVideosNews";
import { useProfile } from "@/hooks/useProfile";
import { findLevel, isReviewLevel } from "@/lib/level";
import { cleanVimeoPlayerUrl, vimeoEmbedUrl } from "@/lib/lessonVideoDisplay";
import { reelEmbedUrl, type PremiumVideo } from "@/lib/premiumVideos";
import { recordVideoView } from "@/lib/premiumVideoSocial.functions";
import { loadPremiumVideos } from "@/lib/premiumVideos.functions";
import { extraVideoWatchedKey } from "@/lib/extraVideoQuickWin";
import { studyToday } from "@/lib/today";
import { cn } from "@/lib/utils";

/** The learning path's level chip (src/routes/_authenticated/learning/index.tsx). */
const LEVEL_CHIP =
  "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/60";

export const Route = createFileRoute("/_authenticated/learning/videos")({
  head: () => ({
    meta: [
      { title: "Extra videos - Evoluir+ English AI" },
      {
        name: "description",
        content: "Extra lesson videos for Premium students, by level.",
      },
    ],
  }),
  // Shorts have their own page (owner request, 2026-11-01): older links and
  // pushes with ?feed=shorts land there, playing.
  validateSearch: (search: Record<string, unknown>): { feed?: "shorts" } =>
    search["feed"] === "shorts" ? { feed: "shorts" } : {},
  beforeLoad: ({ search }) => {
    if (search.feed === "shorts") throw redirect({ to: "/shorts", search: { play: 1 } });
  },
  component: ExtraVideosPage,
});

/**
 * Premium extra videos (owner decision, 2026-10-31: by level only): the
 * owner's Vimeo videos of each level, in the order they were added, not tied
 * to a unit or lesson. Premium students watch them
 * here; free students see the list with locks and the Premium invitation (the
 * server hands out the links only to Premium). Optional: they never count
 * toward the checklist, the study day or the Final Test.
 */
function ExtraVideosPage() {
  const { data: profile } = useProfile();
  const fetchVideos = useServerFn(loadPremiumVideos);
  const query = useQuery({
    queryKey: ["premium-videos", profile?.id],
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchVideos(),
  });
  // Regular videos only: shorts have their own page, /shorts (owner request,
  // 2026-11-01).
  const videos = useMemo(
    () => (query.data?.videos ?? []).filter((video) => video.kind !== "short"),
    [query.data?.videos],
  );
  // Opening the page clears the "Just added" mark of the pill and the bell.
  const { markSeen } = useExtraVideosNews(profile?.id);
  useEffect(() => {
    if (videos.length > 0) markSeen();
  }, [videos.length, markSeen]);
  const premium = query.data?.premium ?? false;
  const levels = useMemo(() => [...new Set(videos.map((video) => video.level))], [videos]);
  const studentLevel = findLevel(profile?.level).value;
  const [picked, setPicked] = useState<string | null>(null);
  const highest = findLevel(profile?.max_level || profile?.level).value;
  // Level chips as on the learning path (owner request, 2026-10-31): "My level"
  // first, always, then the other levels that have videos, conquered ones with
  // a check.
  const otherLevels = levels.filter((value) => value !== studentLevel);
  const level = picked ?? (profile ? studentLevel : (levels[0] ?? null));
  const [playing, setPlaying] = useState<string | null>(null);
  const pickLevel = (value: string) => {
    setPicked(value);
    setPlaying(null);
  };
  // Playing a video closes today's "Watch an extra video" Quick Win: on this
  // device at once, and on the server (migration 0104) for every device and the
  // Admin's numbers. A failed record never stops the video.
  const queryClient = useQueryClient();
  const sendView = useServerFn(recordVideoView);
  const recordView = (id: string) => {
    void sendView({ data: { videoId: id } })
      .then((result) => {
        if (result.recorded)
          void queryClient.invalidateQueries({ queryKey: ["premium-videos", profile?.id] });
      })
      .catch(() => undefined);
  };
  const watch = (id: string) => {
    setPlaying(id);
    recordView(id);
    if (!profile?.id) return;
    try {
      window.localStorage.setItem(extraVideoWatchedKey(profile.id, studyToday()), "1");
    } catch {
      /* the server's record still closes the Quick Win */
    }
  };

  const levelVideos = useMemo(
    () => videos.filter((video) => video.level === level),
    [videos, level],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          to="/learning"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Learning Center
        </Link>

        <PageHeader
          icon={Clapperboard}
          eyebrow={<>Premium extras</>}
          title={<>Extra lesson videos</>}
          description={<>Short videos that go deeper into the lessons of your path.</>}
          actions={<PremiumBadge />}
        >
          {profile && otherLevels.length > 0 ? (
            <nav className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Levels">
              <button
                type="button"
                aria-current={level === studentLevel ? "page" : undefined}
                onClick={() => pickLevel(studentLevel)}
                className={cn(
                  LEVEL_CHIP,
                  level === studentLevel
                    ? "border-transparent bg-brand-green text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span>My level</span> · <span>{studentLevel.toUpperCase()}</span>
              </button>
              <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Layers className="size-3.5" aria-hidden="true" />
                <span>Other levels</span>
              </span>
              {otherLevels.map((value) => {
                const active = value === level;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => pickLevel(value)}
                    className={cn(
                      LEVEL_CHIP,
                      active
                        ? "border-brand-green/60 bg-brand-green/15 text-brand-green"
                        : "border-brand-green/25 text-brand-green/85 hover:border-brand-green/60 hover:bg-brand-green/10",
                    )}
                  >
                    {isReviewLevel(value, highest) ? (
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    ) : null}
                    {value.toUpperCase()}
                  </button>
                );
              })}
            </nav>
          ) : null}
        </PageHeader>

        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !premium && query.data ? (
          <div className="card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm">
              <Crown className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>Extra videos are part of Premium. Subscribe to watch every one of them.</span>
            </p>
            <Button asChild size="sm">
              <Link to="/premium">See plans</Link>
            </Button>
          </div>
        ) : null}

        {!query.isPending && levelVideos.length === 0 ? (
          <p className="card-soft p-6 text-sm text-muted-foreground">
            No extra videos here yet. New ones are added over time.
          </p>
        ) : null}

        {levelVideos.length > 0 ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {levelVideos.map((video) => {
              const embed = video.url ? vimeoEmbedUrl(video.url) : null;
              const open = playing === video.id && embed;
              return (
                <li key={video.id} className="card-soft overflow-hidden">
                  {open ? (
                    <div className="relative bg-black">
                      <iframe
                        className="aspect-video w-full"
                        src={`${cleanVimeoPlayerUrl(embed)}&autoplay=1`}
                        title={video.title}
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3 p-3">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl",
                        premium ? "bg-warning/12 text-warning" : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {premium ? <PlayCircle className="size-5" /> : <Lock className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold" translate="no">
                        {video.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span>Level</span> <span>{video.level.toUpperCase()}</span>
                      </span>
                    </span>
                    {premium && embed ? (
                      open ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0"
                          aria-label="Close video"
                          onClick={() => setPlaying(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => watch(video.id)}
                        >
                          <PlayCircle className="size-4" /> Watch
                        </Button>
                      )
                    ) : (
                      <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </AppShell>
  );
}

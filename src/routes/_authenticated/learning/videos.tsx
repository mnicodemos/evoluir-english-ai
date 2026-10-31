import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Crown,
  Film,
  Heart,
  Layers,
  Lock,
  MessageCircle,
  PlayCircle,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExtraVideosNews } from "@/hooks/useExtraVideosNews";
import { useProfile } from "@/hooks/useProfile";
import { findLevel, isReviewLevel } from "@/lib/level";
import { cleanVimeoPlayerUrl, vimeoEmbedUrl } from "@/lib/lessonVideoDisplay";
import { ShortsFeed } from "@/components/shorts/ShortsFeed";
import { useShortsShortcut } from "@/hooks/useShortsShortcut";
import { useVideoSocial } from "@/hooks/useVideoSocial";
import { reelEmbedUrl, type PremiumVideo } from "@/lib/premiumVideos";
import { recordVideoView, type VideoSocialCounts } from "@/lib/premiumVideoSocial.functions";
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
  // ?feed=shorts (the phone Dashboard's Shorts shortcut) opens the Shorts tab
  // and, for Premium, the feed at its first short.
  validateSearch: (search: Record<string, unknown>): { feed?: "shorts" } =>
    search["feed"] === "shorts" ? { feed: "shorts" } : {},
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
  const videos = useMemo(() => query.data?.videos ?? [], [query.data?.videos]);
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
    setPickedTab(null);
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

  const levelAll = useMemo(() => videos.filter((video) => video.level === level), [videos, level]);
  const levelShorts = useMemo(() => levelAll.filter((video) => video.kind === "short"), [levelAll]);
  // Shorts (owner request, 2026-10-31: vertical videos and Instagram Reels) have
  // their own tab, the first one (owner request, 2026-10-31); a level with
  // regular videos and no shorts opens on Videos.
  const [pickedTab, setPickedTab] = useState<"videos" | "shorts" | null>(null);
  const tab = pickedTab ?? (levelShorts.length === 0 && levelAll.length > 0 ? "videos" : "shorts");
  const levelVideos = useMemo(
    () => levelAll.filter((video) => (video.kind === "short") === (tab === "shorts")),
    [levelAll, tab],
  );
  // Likes and comments of the level's shorts (migration 0103), and the
  // full-screen feed opened on the short that was tapped.
  const shortIds = useMemo(() => levelShorts.map((video) => video.id), [levelShorts]);
  const social = useVideoSocial(profile?.id, shortIds);
  const [feedStart, setFeedStart] = useState<number | null>(null);
  // The Shorts shortcut: the Shorts tab of the student's level, and the feed
  // at once for Premium (once per visit).
  const search = Route.useSearch();
  const shortcutApplied = useRef(false);
  useEffect(() => {
    if (search.feed !== "shorts" || shortcutApplied.current || !query.data) return;
    shortcutApplied.current = true;
    setPickedTab("shorts");
    if (premium && levelShorts.some((video) => !!video.url)) setFeedStart(0);
  }, [search.feed, query.data, premium, levelShorts]);
  // Seeing the Shorts tab of their own level clears the shortcut's dot.
  const shortsShortcut = useShortsShortcut(profile?.id, profile?.level);
  const markShortsSeen = shortsShortcut.markSeen;
  useEffect(() => {
    if (tab === "shorts" && level === studentLevel && levelShorts.length > 0) markShortsSeen();
  }, [tab, level, studentLevel, levelShorts.length, markShortsSeen]);

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
          accent="amber"
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

        {!query.isPending ? (
          <div
            role="tablist"
            aria-label="Video type"
            className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1"
          >
            {(
              [
                ["shorts", Smartphone, "Shorts", levelShorts.length],
                ["videos", Film, "Videos", levelAll.length - levelShorts.length],
              ] as const
            ).map(([value, Icon, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => {
                  setPickedTab(value);
                  setPlaying(null);
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
                  tab === value
                    ? "bg-brand-green text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{label}</span>
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {!query.isPending && levelVideos.length === 0 ? (
          <p className="card-soft p-6 text-sm text-muted-foreground">
            {tab === "shorts"
              ? "No shorts here yet. New ones are added over time."
              : "No extra videos here yet. New ones are added over time."}
          </p>
        ) : null}

        {tab === "shorts" && levelVideos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {levelVideos.map((video, index) => (
              <ShortCard
                key={video.id}
                video={video}
                premium={premium}
                counts={social.ready ? social.counts[video.id] : undefined}
                onOpen={() => {
                  watch(video.id);
                  setFeedStart(index);
                }}
              />
            ))}
          </ul>
        ) : null}

        {feedStart !== null && tab === "shorts" && premium ? (
          <ShortsFeed
            videos={levelVideos.filter((video) => !!video.url)}
            startIndex={Math.min(feedStart, Math.max(0, levelVideos.length - 1))}
            social={social}
            onLike={social.toggleLike}
            onCommentsChanged={social.refresh}
            onView={recordView}
            onClose={() => {
              setFeedStart(null);
              setPlaying(null);
            }}
          />
        ) : null}

        {tab === "videos" && levelVideos.length > 0 ? (
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

/** One short in the 9:16 grid: tapping it opens the full-screen feed there. */
function ShortCard({
  video,
  premium,
  counts,
  onOpen,
}: {
  video: PremiumVideo;
  premium: boolean;
  counts: VideoSocialCounts | undefined;
  onOpen: () => void;
}) {
  const playable = premium && !!video.url;
  const reel = !!(video.url && reelEmbedUrl(video.url));
  return (
    <li className="card-soft overflow-hidden">
      <button
        type="button"
        disabled={!playable}
        onClick={onOpen}
        aria-label={playable ? video.title : undefined}
        className="group relative block aspect-[9/16] w-full bg-black bg-[radial-gradient(circle_at_50%_35%,rgb(245_158_11/0.18),transparent_65%)] disabled:cursor-default"
      >
        <span
          className={cn(
            "absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition-transform group-hover:scale-105",
            !playable && "opacity-70",
          )}
          aria-hidden="true"
        >
          {playable ? (
            <PlayCircle className="size-7 text-warning" />
          ) : (
            <Lock className="size-5 text-muted-foreground" />
          )}
        </span>
        {reel ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/85">
            Reel
          </span>
        ) : null}
        {counts ? (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs font-semibold text-white/90 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Heart
                className={cn("size-3.5", counts.liked && "fill-rose-500 text-rose-500")}
                aria-hidden="true"
              />
              {counts.likes}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden="true" />
              {counts.comments}
            </span>
          </span>
        ) : null}
      </button>
      <p
        className="line-clamp-2 px-3 py-2 text-sm font-semibold leading-snug"
        translate="no"
        title={video.title}
      >
        {video.title}
      </p>
    </li>
  );
}

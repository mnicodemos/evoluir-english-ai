import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Heart, Lock, MessageCircle, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { EvoAvatar } from "@/components/EvoAvatar";
import { ShortsFeed } from "@/components/shorts/ShortsFeed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useShortsShortcut } from "@/hooks/useShortsShortcut";
import { useVideoSocial } from "@/hooks/useVideoSocial";
import { extraVideoWatchedKey } from "@/lib/extraVideoQuickWin";
import { findLevel, isReviewLevel } from "@/lib/level";
import { reelEmbedUrl, type PremiumVideo } from "@/lib/premiumVideos";
import { loadPremiumVideos } from "@/lib/premiumVideos.functions";
import { recordVideoView, type VideoSocialCounts } from "@/lib/premiumVideoSocial.functions";
import { studyToday } from "@/lib/today";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shorts")({
  head: () => ({
    meta: [
      { title: "Shorts - Evoluir+ English AI" },
      {
        name: "description",
        content: "Quick English in vertical videos, by level, with likes and comments.",
      },
    ],
  }),
  // ?play=1 (the phone Dashboard's shortcut and the new-short push) opens the
  // feed at once for Premium.
  validateSearch: (search: Record<string, unknown>): { play?: 1 } =>
    search["play"] === 1 || search["play"] === "1" ? { play: 1 } : {},
  component: ShortsPage,
});

/** The ring of a selected level "story", like Instagram's. */
const STORY_RING = "bg-[conic-gradient(from_200deg,#f59e0b,#ec4899,#22d3ee,#f59e0b)]";

/**
 * Shorts on their own page (owner request, 2026-11-01: one of the app's
 * flagships, with the look of TikTok and Instagram; the extra lesson videos
 * stay on /learning/videos): a profile header (EVO's portrait in a story ring,
 * the level's numbers and Watch), the levels as story circles, and a tight
 * 3-column grid of 9:16 tiles; a tile, or Watch, opens the full-screen feed
 * (ShortsFeed: swipe, tap to pause, double tap to like, comments). Premium
 * plays them; free students see the grid with locks and the invitation (the
 * server hands out the links only to Premium).
 */
function ShortsPage() {
  const { data: profile } = useProfile();
  const fetchVideos = useServerFn(loadPremiumVideos);
  const query = useQuery({
    queryKey: ["premium-videos", profile?.id],
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchVideos(),
  });
  const shorts = useMemo(
    () => (query.data?.videos ?? []).filter((video) => video.kind === "short"),
    [query.data?.videos],
  );
  const premium = query.data?.premium ?? false;
  const studentLevel = findLevel(profile?.level).value;
  const highest = findLevel(profile?.max_level || profile?.level).value;
  const otherLevels = useMemo(
    () => [...new Set(shorts.map((video) => video.level))].filter((v) => v !== studentLevel),
    [shorts, studentLevel],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const level = picked ?? studentLevel;
  const levelShorts = useMemo(
    () => shorts.filter((video) => video.level === level),
    [shorts, level],
  );
  const playable = useMemo(() => levelShorts.filter((video) => !!video.url), [levelShorts]);

  const social = useVideoSocial(
    profile?.id,
    levelShorts.map((video) => video.id),
  );
  const likes = social.ready
    ? levelShorts.reduce((sum, video) => sum + (social.counts[video.id]?.likes ?? 0), 0)
    : null;

  // A play closes today's "Watch an extra video" Quick Win (this device at once,
  // the server for every device); a failed record never stops the short.
  const queryClient = useQueryClient();
  const sendView = useServerFn(recordVideoView);
  const recordView = (id: string) => {
    void sendView({ data: { videoId: id } })
      .then((result) => {
        if (result.recorded)
          void queryClient.invalidateQueries({ queryKey: ["premium-videos", profile?.id] });
      })
      .catch(() => undefined);
    if (!profile?.id) return;
    try {
      window.localStorage.setItem(extraVideoWatchedKey(profile.id, studyToday()), "1");
    } catch {
      /* the server's record still closes the Quick Win */
    }
  };

  const [feedStart, setFeedStart] = useState<number | null>(null);
  const open = (video: PremiumVideo) => {
    const index = playable.findIndex((item) => item.id === video.id);
    if (index >= 0) setFeedStart(index);
  };

  // ?play=1 opens the feed once per visit, for Premium.
  const search = Route.useSearch();
  const autoplayed = useRef(false);
  useEffect(() => {
    if (search.play !== 1 || autoplayed.current || !query.data) return;
    autoplayed.current = true;
    if (premium && playable.length > 0) setFeedStart(0);
  }, [search.play, query.data, premium, playable.length]);

  // Seeing the student's own level clears the phone shortcut's dot.
  const { markSeen } = useShortsShortcut(profile?.id, profile?.level);
  useEffect(() => {
    if (level === studentLevel && levelShorts.length > 0) markSeen();
  }, [level, studentLevel, levelShorts.length, markSeen]);

  const levels = profile ? [studentLevel, ...otherLevels] : [];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        {/* Profile header, Instagram-style. */}
        <header className="flex items-center gap-4 sm:gap-8">
          <span className={cn("shrink-0 rounded-full p-[3px]", STORY_RING)}>
            <span className="block rounded-full bg-background p-[3px]">
              <EvoAvatar decorative className="size-20 rounded-full object-cover sm:size-28" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-green">
              EVO · Shorts
            </p>
            <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
              Shorts
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Quick English, one minute at a time.
            </p>
            <dl className="mt-3 flex gap-5 text-sm">
              <div>
                <dt className="sr-only">Shorts</dt>
                <dd>
                  <span className="font-semibold tabular-nums">{levelShorts.length}</span>{" "}
                  <span className="text-muted-foreground">shorts</span>
                </dd>
              </div>
              {likes !== null ? (
                <div>
                  <dt className="sr-only">Likes</dt>
                  <dd>
                    <span className="font-semibold tabular-nums">{likes}</span>{" "}
                    <span className="text-muted-foreground">likes</span>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="sr-only">Level</dt>
                <dd>
                  <span className="text-muted-foreground">Level</span>{" "}
                  <span className="font-semibold">{level.toUpperCase()}</span>
                </dd>
              </div>
            </dl>
          </div>
          {premium && playable.length > 0 ? (
            <Button
              className="hidden shrink-0 gap-1.5 sm:inline-flex"
              onClick={() => setFeedStart(0)}
            >
              <Play className="size-4 fill-current" aria-hidden="true" />
              Watch
            </Button>
          ) : null}
        </header>
        {premium && playable.length > 0 ? (
          <Button className="mt-4 w-full gap-1.5 sm:hidden" onClick={() => setFeedStart(0)}>
            <Play className="size-4 fill-current" aria-hidden="true" />
            Watch
          </Button>
        ) : null}

        {/* Levels as story circles: my level first, then the others with shorts. */}
        {levels.length > 1 ? (
          <nav
            className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            aria-label="Levels"
          >
            {levels.map((value, index) => {
              const active = value === level;
              return (
                <button
                  key={value}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setPicked(value)}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none"
                >
                  <span
                    className={cn("rounded-full p-[2.5px]", active ? STORY_RING : "bg-white/15")}
                  >
                    <span className="relative grid size-14 place-items-center rounded-full bg-background font-display text-base font-semibold">
                      {value.toUpperCase()}
                      {index > 0 && isReviewLevel(value, highest) ? (
                        <Check
                          className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-brand-green p-0.5 text-primary-foreground"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {index === 0 ? "My level" : value.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </nav>
        ) : null}

        {!premium && query.data ? (
          <div className="card-soft mt-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm">
              <Crown className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>Shorts are part of Premium. Subscribe to watch every one of them.</span>
            </p>
            <Button asChild size="sm">
              <Link to="/premium">See plans</Link>
            </Button>
          </div>
        ) : null}

        <div className="mt-5 border-t border-white/10 pt-0.5">
          {query.isPending ? (
            <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="aspect-[9/16] rounded-none" />
              ))}
            </div>
          ) : levelShorts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No shorts here yet. New ones are added over time.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-0.5 sm:gap-1">
              {levelShorts.map((video) => (
                <ShortTile
                  key={video.id}
                  video={video}
                  premium={premium}
                  counts={social.ready ? social.counts[video.id] : undefined}
                  onOpen={() => open(video)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {feedStart !== null && premium ? (
        <ShortsFeed
          videos={playable}
          startIndex={Math.min(feedStart, Math.max(0, playable.length - 1))}
          social={social}
          onLike={social.toggleLike}
          onCommentsChanged={social.refresh}
          onView={recordView}
          onClose={() => setFeedStart(null)}
        />
      ) : null}
    </AppShell>
  );
}

/** One 9:16 tile of the grid, Instagram-style: the title and the counts over it. */
function ShortTile({
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
    <li>
      <button
        type="button"
        disabled={!playable}
        onClick={onOpen}
        aria-label={video.title}
        className="group relative block aspect-[9/16] w-full overflow-hidden bg-black bg-[radial-gradient(circle_at_50%_30%,rgb(34_211_238/0.22),transparent_60%),radial-gradient(circle_at_80%_90%,rgb(236_72_153/0.18),transparent_55%)] text-left disabled:cursor-default"
      >
        <span
          className={cn(
            "absolute left-1/2 top-[42%] grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 backdrop-blur transition-transform group-hover:scale-110",
            !playable && "opacity-70",
          )}
          aria-hidden="true"
        >
          {playable ? (
            <Play className="size-5 fill-white text-white" />
          ) : (
            <Lock className="size-4 text-white/80" />
          )}
        </span>
        {reel ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/85">
            Reel
          </span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-10">
          <span
            className="line-clamp-2 text-[11px] font-semibold leading-snug text-white sm:text-xs"
            translate="no"
          >
            {video.title}
          </span>
          {counts ? (
            <span className="mt-1 flex items-center gap-2.5 text-[11px] font-semibold tabular-nums text-white/85">
              <span className="inline-flex items-center gap-1">
                <Heart
                  className={cn("size-3", counts.liked && "fill-rose-500 text-rose-500")}
                  aria-hidden="true"
                />
                {counts.likes}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3" aria-hidden="true" />
                {counts.comments}
              </span>
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

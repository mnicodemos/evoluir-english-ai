import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Clapperboard, Crown, Layers, Lock, PlayCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExtraVideosNews } from "@/hooks/useExtraVideosNews";
import { useProfile } from "@/hooks/useProfile";
import { useUiLang } from "@/lib/uiLang";
import { uiPt } from "@/lib/uiDictionary";
import { findLevel, isReviewLevel, LEVELS } from "@/lib/level";
import {
  cleanVimeoPlayerUrl,
  vimeoEmbedUrl,
  vimeoTextTrackUrl,
  vimeoThumbnailUrl,
} from "@/lib/lessonVideoDisplay";
import { recordVideoView } from "@/lib/premiumVideoSocial.functions";
import { loadPremiumVideos } from "@/lib/premiumVideos.functions";
import { extraVideoWatchedKey } from "@/lib/extraVideoQuickWin";
import { studyToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import { isVimeoEndedMessage, isVimeoReadyMessage } from "@/lib/vimeoPlayerEvents";

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
  const { lang } = useUiLang();
  const t = (text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text);
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
  const otherLevels = useMemo(
    () => LEVELS.map((item) => item.value).filter((value) => value !== studentLevel),
    [studentLevel],
  );
  const level = picked ?? (profile ? studentLevel : (levels[0] ?? null));
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadedPlayer, setLoadedPlayer] = useState<string | null>(null);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const completionInFlight = useRef(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const pickLevel = (value: string) => {
    setPicked(value);
    setPlaying(null);
    setLoadedPlayer(null);
    setCompletionError(false);
    setCompletionPending(false);
    completionInFlight.current = false;
  };
  // The Quick Win is completed only by Vimeo's actual "ended" event.
  // Loading the page, mounting the iframe, or pressing Play is not completion.
  const queryClient = useQueryClient();
  const sendView = useServerFn(recordVideoView);
  const recordView = useCallback(
    async (id: string) => {
      try {
        const result = await sendView({ data: { videoId: id } });
        if (result.recorded) {
          const queryKey = ["premium-videos", profile?.id] as const;
          const latest =
            queryClient.getQueryData<Awaited<ReturnType<typeof fetchVideos>>>(queryKey) ??
            query.data;
          // recordVideoView has confirmed the persisted write. Publish that
          // confirmed status immediately so the Dashboard selector can update
          // without waiting for another network round trip.
          if (latest) {
            queryClient.setQueryData(queryKey, {
              ...latest,
              watchedToday: true,
            });
          }
          // Mark the video list stale without allowing a concurrent refetch to
          // overwrite the confirmed completion with an older response. The
          // next visit will still fetch the server's persisted truth.
          await queryClient.invalidateQueries({
            queryKey,
            refetchType: "none",
          });
          await queryClient.invalidateQueries({
            queryKey: ["next-step"],
            refetchType: "all",
          });
          // The view just earned 5 league XP: the league cell, the phone pill
          // and the league page read it fresh instead of a 5-minute-old cache.
          await Promise.all(
            [["weekly-league"], ["week-xp-history"], ["weekly-league-history"]].map((key) =>
              queryClient.invalidateQueries({ queryKey: key, refetchType: "all" }),
            ),
          );
        }
        return result.recorded;
      } catch {
        return false;
      }
    },
    [profile?.id, query.data, queryClient, sendView],
  );
  const completeWatch = useCallback(
    async (id: string) => {
      const recorded = await recordView(id);
      if (!recorded || !profile?.id) return false;
      try {
        window.localStorage.setItem(extraVideoWatchedKey(profile.id, studyToday()), "1");
      } catch {
        /* The server record remains authoritative across devices. */
      }
      return true;
    },
    [profile?.id, recordView],
  );

  useEffect(() => {
    if (!playing) return;
    const onMessage = async (event: MessageEvent) => {
      if (
        event.origin !== "https://player.vimeo.com" ||
        event.source !== playerRef.current?.contentWindow
      ) {
        return;
      }

      // Vimeo's API only accepts addEventListener after its ready handshake.
      // Registering on iframe load can race the Player API initialization.
      if (isVimeoReadyMessage(event.data)) {
        playerRef.current?.contentWindow?.postMessage(
          JSON.stringify({ method: "addEventListener", value: "ended" }),
          "https://player.vimeo.com",
        );
        return;
      }

      if (!isVimeoEndedMessage(event.data) || completionInFlight.current) return;
      completionInFlight.current = true;
      setCompletionPending(true);
      setCompletionError(false);
      const recorded = await completeWatch(playing);
      setCompletionPending(false);
      completionInFlight.current = false;
      if (recorded) {
        setPlaying(null);
      } else {
        // Keep the finished player mounted and let the student retry the
        // server confirmation; never silently leave the Quick Win pending.
        setCompletionError(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [playing, completeWatch, queryClient]);

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
          title={<>Extra learning videos</>}
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
                const locked =
                  LEVELS.findIndex((item) => item.value === value) >
                  LEVELS.findIndex((item) => item.value === highest);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    aria-disabled={locked}
                    disabled={locked}
                    onClick={() => pickLevel(value)}
                    className={cn(
                      LEVEL_CHIP,
                      locked && "cursor-not-allowed opacity-35",
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
              const poster = vimeoThumbnailUrl(video.url);
              const basePlayerUrl = embed
                ? ["a1", "a2"].includes(video.level.toLowerCase())
                  ? vimeoTextTrackUrl(embed, "pt")
                  : cleanVimeoPlayerUrl(embed)
                : null;
              const playerUrl = basePlayerUrl ? new URL(basePlayerUrl) : null;
              playerUrl?.searchParams.set("api", "1");
              playerUrl?.searchParams.set("player_id", video.id);
              return (
                <li key={video.id} className="card-soft overflow-hidden">
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {premium && embed && open && playerUrl ? (
                      <>
                        {poster ? (
                          <img
                            src={poster}
                            alt=""
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-0 size-full object-cover transition-opacity",
                              loadedPlayer === video.id ? "opacity-0" : "opacity-100",
                            )}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <iframe
                          id={video.id}
                          ref={playerRef}
                          className={cn(
                            "absolute inset-0 size-full transition-opacity",
                            loadedPlayer === video.id ? "opacity-100" : "opacity-0",
                          )}
                          src={playerUrl.toString()}
                          title={video.title}
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                          allowFullScreen
                          onLoad={(event) => {
                            setLoadedPlayer(video.id);
                            // Also subscribe once the iframe loads, in case its
                            // "ready" message arrived before our listener ran.
                            event.currentTarget.contentWindow?.postMessage(
                              JSON.stringify({ method: "addEventListener", value: "ended" }),
                              "https://player.vimeo.com",
                            );
                          }}
                        />
                      </>
                    ) : premium && embed ? (
                      <button
                        type="button"
                        className="absolute inset-0 grid place-items-center bg-black text-white transition hover:bg-black/80"
                        onClick={() => {
                          setLoadedPlayer(null);
                          setPlaying(video.id);
                        }}
                        aria-label={`Play ${video.title}`}
                      >
                        {poster ? (
                          <img
                            src={poster}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 size-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className="relative z-10 grid size-14 place-items-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm">
                          <PlayCircle className="size-8" />
                        </span>
                      </button>
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-black">
                        <span className="grid size-14 place-items-center rounded-full border border-white/15 bg-white/10 text-white">
                          <Lock className="size-6" />
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold" translate="no">
                        {video.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        <span>Level</span> <span>{video.level.toUpperCase()}</span>
                      </span>
                    </span>
                    {open ? (
                      <div className="flex shrink-0 items-center gap-2">
                        {completionPending ? (
                          <span className="text-xs text-muted-foreground">Saving completion…</span>
                        ) : null}
                        {completionError ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCompletionError(false);
                              setCompletionPending(true);
                              void completeWatch(video.id).then((recorded) => {
                                setCompletionPending(false);
                                if (recorded) setPlaying(null);
                                else setCompletionError(true);
                              });
                            }}
                          >
                            Retry completion
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0"
                          aria-label="Close video"
                          onClick={() => setPlaying(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : null}
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

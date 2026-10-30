import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clapperboard, Crown, Lock, PlayCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExtraVideosNews } from "@/hooks/useExtraVideosNews";
import { useProfile } from "@/hooks/useProfile";
import { findLevel } from "@/lib/level";
import { cleanVimeoPlayerUrl, vimeoEmbedUrl } from "@/lib/lessonVideoDisplay";
import { loadPremiumVideos } from "@/lib/premiumVideos.functions";
import { cn } from "@/lib/utils";

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
  const level = picked ?? (levels.includes(studentLevel) ? studentLevel : (levels[0] ?? null));
  const [playing, setPlaying] = useState<string | null>(null);

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
          accent="amber"
          eyebrow={<>Premium extras</>}
          title={<>Extra lesson videos</>}
          description={<>Short videos that go deeper into the lessons of your path.</>}
          actions={<PremiumBadge />}
        >
          {levels.length > 1 ? (
            <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Levels">
              {levels.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-current={value === level ? "page" : undefined}
                  onClick={() => {
                    setPicked(value);
                    setPlaying(null);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    value === level
                      ? "border-transparent bg-brand-green text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value.toUpperCase()}
                </button>
              ))}
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
                          onClick={() => setPlaying(video.id)}
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

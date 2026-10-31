import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronUp,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  Play,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { cleanVimeoPlayerUrl, vimeoEmbedUrl } from "@/lib/lessonVideoDisplay";
import { reelEmbedUrl, type PremiumVideo } from "@/lib/premiumVideos";
import { COMMENT_MAX_LENGTH, DOUBLE_TAP_MS, shortTap } from "@/lib/premiumVideoSocial";
import {
  addVideoComment,
  deleteOwnVideoComment,
  loadVideoComments,
  reportVideoComment,
  type VideoSocialCounts,
} from "@/lib/premiumVideoSocial.functions";
import { haptic } from "@/lib/haptics";
import { graphitePanelClass } from "@/lib/surfaces";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";
import { cn } from "@/lib/utils";

type Props = {
  videos: PremiumVideo[];
  startIndex: number;
  social: { ready: boolean; counts: Record<string, VideoSocialCounts> };
  onLike: (videoId: string) => void;
  onCommentsChanged: () => void;
  /** Called once for each short that comes on screen (the server records the play). */
  onView?: (videoId: string) => void;
  onClose: () => void;
};

/**
 * The Shorts feed (owner request, 2026-10-31: an Instagram-like way to watch,
 * with likes and comments): full screen, one short per screen, swipe or scroll
 * up for the next. Only the short on screen has a player. A Vimeo short sits
 * under a clear layer that takes the swipe (an iframe would swallow it): one
 * tap pauses or plays it through Vimeo's postMessage API, a double tap likes
 * it. A Reel keeps Instagram's own player, so the arrows move between shorts.
 */
export function ShortsFeed({
  videos,
  startIndex,
  social,
  onLike,
  onCommentsChanged,
  onView,
  onClose,
}: Props) {
  const { lang } = useUiLang();
  const t = useCallback((text: string) => (lang === "pt" ? (uiPt[text] ?? text) : text), [lang]);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startIndex);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  // Opens on the short that was tapped.
  useEffect(() => {
    const item = scroller.current?.children[startIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "start" });
  }, [startIndex]);

  // The short on screen is the one more than half visible.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setActive(Number((entry.target as HTMLElement).dataset["index"] ?? 0));
      },
      { root, threshold: 0.6 },
    );
    for (const child of Array.from(root.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [videos.length]);

  // Each short that comes on screen counts as watched once.
  const viewed = useRef(new Set<string>());
  useEffect(() => {
    const id = videos[active]?.id;
    if (!id || viewed.current.has(id)) return;
    viewed.current.add(id);
    onView?.(id);
  }, [active, videos, onView]);

  const go = useCallback(
    (step: number) => {
      const next = Math.min(videos.length - 1, Math.max(0, active + step));
      const item = scroller.current?.children[next] as HTMLElement | undefined;
      item?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [active, videos.length],
  );

  // The page under the feed stays still; Escape closes, arrows move.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (commentsFor) setCommentsFor(null);
        else onClose();
      } else if (!commentsFor && event.key === "ArrowDown") go(1);
      else if (!commentsFor && event.key === "ArrowUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [commentsFor, go, onClose]);

  return createPortal(
    <div
      className="dashboard-shell dark fixed inset-0 z-[80] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("Shorts")}
    >
      <div
        ref={scroller}
        className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {videos.map((video, index) => (
          <ShortSlide
            key={video.id}
            index={index}
            video={video}
            active={index === active}
            counts={social.ready ? social.counts[video.id] : undefined}
            onLike={() => onLike(video.id)}
            onComments={() => setCommentsFor(video.id)}
            t={t}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t("Close")}
        className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-black/50 backdrop-blur"
      >
        <X className="size-5" />
      </button>
      <p className="pointer-events-none absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] -translate-x-1/2 text-sm font-semibold tracking-wide text-white/85">
        Shorts
        <span className="ml-1.5 text-white/50 tabular-nums">
          {active + 1}/{videos.length}
        </span>
      </p>

      {/* Arrows: always on desktop, and the way to move over a Reel's player. */}
      <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
        <FeedArrow label={t("Previous")} disabled={active === 0} onClick={() => go(-1)}>
          <ChevronUp className="size-5" />
        </FeedArrow>
        <FeedArrow label={t("Next")} disabled={active >= videos.length - 1} onClick={() => go(1)}>
          <ChevronDown className="size-5" />
        </FeedArrow>
      </div>

      {commentsFor ? (
        <CommentsPanel
          videoId={commentsFor}
          t={t}
          onClose={() => setCommentsFor(null)}
          onChanged={onCommentsChanged}
        />
      ) : null}
    </div>,
    document.body,
  );
}

function FeedArrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 backdrop-blur transition hover:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ShortSlide({
  index,
  video,
  active,
  counts,
  onLike,
  onComments,
  t,
}: {
  index: number;
  video: PremiumVideo;
  active: boolean;
  counts: VideoSocialCounts | undefined;
  onLike: () => void;
  onComments: () => void;
  t: (text: string) => string;
}) {
  const reel = video.url ? reelEmbedUrl(video.url) : null;
  const vimeo = !reel && video.url ? vimeoEmbedUrl(video.url) : null;
  const frame = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);

  // Vimeo tells the page when it plays or pauses (its postMessage API).
  useEffect(() => {
    if (!active || !vimeo) return;
    setPaused(false);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://player.vimeo.com") return;
      if (event.source !== frame.current?.contentWindow) return;
      let message: { event?: string } = {};
      try {
        message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (message.event === "ready") {
        for (const name of ["play", "pause"])
          frame.current?.contentWindow?.postMessage(
            JSON.stringify({ method: "addEventListener", value: name }),
            "https://player.vimeo.com",
          );
      } else if (message.event === "play") setPaused(false);
      else if (message.event === "pause") setPaused(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active, vimeo]);

  const tellVimeo = (method: "play" | "pause") =>
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ method }),
      "https://player.vimeo.com",
    );

  // One tap pauses or plays; a double tap likes (and never unlikes), like Instagram.
  const onTap = () => {
    const now = Date.now();
    const tap = shortTap(now, lastTap.current, counts?.liked);
    if (tap.kind === "double") {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      lastTap.current = 0;
      setBurst((value) => value + 1);
      haptic("tap");
      if (tap.like) onLike();
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      tellVimeo(paused ? "play" : "pause");
      setPaused(!paused);
    }, DOUBLE_TAP_MS);
  };

  const src = reel
    ? reel
    : vimeo
      ? `${cleanVimeoPlayerUrl(vimeo)}&autoplay=1&controls=0&playsinline=1&loop=1`
      : null;

  return (
    <section
      data-index={index}
      className="relative flex h-[100dvh] snap-start snap-always items-center justify-center"
      aria-label={video.title}
    >
      <div
        className="relative overflow-hidden bg-neutral-950 sm:rounded-2xl"
        style={{ aspectRatio: "9 / 16", height: "min(100dvh, calc(100vw * 16 / 9))" }}
      >
        {active && src ? (
          <iframe
            ref={frame}
            className="absolute inset-0 size-full"
            src={src}
            title={video.title}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,rgb(245_158_11/0.16),transparent_65%)]">
            <Play className="size-10 text-white/40" aria-hidden="true" />
          </div>
        )}

        {active && vimeo ? (
          <button
            type="button"
            onClick={onTap}
            aria-label={paused ? t("Play") : t("Pause")}
            className="absolute inset-0 z-10 grid place-items-center"
          >
            {paused ? (
              <span className="grid size-16 place-items-center rounded-full bg-black/45 backdrop-blur">
                <Play className="size-8 fill-current" aria-hidden="true" />
              </span>
            ) : null}
          </button>
        ) : null}

        {burst > 0 ? (
          <Heart
            key={burst}
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 size-24 -translate-x-1/2 -translate-y-1/2 animate-[short-like_0.8s_ease-out_forwards] fill-rose-500 text-rose-500 drop-shadow-lg"
            aria-hidden="true"
          />
        ) : null}

        {/* Title over a soft gradient, as on the platforms students know. */}
        {!reel ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16 pr-20">
            <p className="line-clamp-3 text-sm font-semibold leading-snug" translate="no">
              {video.title}
            </p>
          </div>
        ) : null}

        {counts ? (
          <div
            className={cn(
              "absolute right-2.5 z-20 flex flex-col items-center gap-4",
              reel ? "top-1/3" : "bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4rem))]",
            )}
          >
            <RailButton
              label={counts.liked ? t("Unlike") : t("Like")}
              count={counts.likes}
              onClick={onLike}
            >
              <Heart
                className={cn(
                  "size-7 drop-shadow transition-transform active:scale-90",
                  counts.liked && "fill-rose-500 text-rose-500",
                )}
              />
            </RailButton>
            <RailButton label={t("Comments")} count={counts.comments} onClick={onComments}>
              <MessageCircle className="size-7 drop-shadow" />
            </RailButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RailButton({
  label,
  count,
  onClick,
  children,
}: {
  label: string;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center gap-0.5 rounded-full bg-black/25 px-2 py-2 text-xs font-semibold tabular-nums backdrop-blur-sm"
    >
      {children}
      <span>{count}</span>
    </button>
  );
}

/** "now", "5 min", "3 h", "2 d" or the date, in the language on screen. */
function timeAgo(iso: string, lang: "pt" | "en"): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return lang === "pt" ? "agora" : "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
  });
}

function CommentsPanel({
  videoId,
  t,
  onClose,
  onChanged,
}: {
  videoId: string;
  t: (text: string) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { lang } = useUiLang();
  const queryClient = useQueryClient();
  const fetchComments = useServerFn(loadVideoComments);
  const add = useServerFn(addVideoComment);
  const remove = useServerFn(deleteOwnVideoComment);
  const report = useServerFn(reportVideoComment);
  const [text, setText] = useState("");
  const queryKey = ["video-comments", videoId];

  const query = useQuery({ queryKey, queryFn: () => fetchComments({ data: { videoId } }) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
    onChanged();
  };
  const fail = (error: unknown) =>
    toast.error(
      t(error instanceof Error ? error.message : "Something went wrong. Please try again."),
    );

  const send = useMutation({
    mutationFn: () => add({ data: { videoId, body: text } }),
    onSuccess: async () => {
      setText("");
      haptic("tap");
      await refresh();
    },
    onError: fail,
  });
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
    onError: fail,
  });
  const flag = useMutation({
    mutationFn: (id: string) => report({ data: { id } }),
    onSuccess: async () => {
      toast.success(t("Thanks. The team will review this comment."));
      await refresh();
    },
    onError: fail,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() && !send.isPending) send.mutate();
  };
  const comments = query.data?.comments ?? [];

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex h-[68dvh] w-full max-w-md flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
          graphitePanelClass,
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={t("Comments")}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold">
            {t("Comments")}
            {comments.length ? (
              <span className="ml-1.5 text-white/50 tabular-nums">{comments.length}</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="grid size-8 place-items-center rounded-full hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {query.isPending ? (
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="size-4 animate-spin" /> {t("Loading...")}
            </p>
          ) : query.isError ? (
            <p className="text-sm text-white/60">
              {t("Could not load the comments. Please try again.")}
            </p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/60">
              {t("No comments yet. Be the first to comment, in English if you can!")}
            </p>
          ) : (
            <ul className="space-y-4">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold"
                    aria-hidden="true"
                  >
                    {comment.author.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/60">
                      <span className="font-semibold text-white/85" translate="no">
                        {comment.author}
                      </span>{" "}
                      · {timeAgo(comment.createdAt, lang)}
                    </p>
                    <p
                      className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-snug"
                      translate="no"
                    >
                      {comment.body}
                    </p>
                  </div>
                  {comment.mine ? (
                    <button
                      type="button"
                      aria-label={t("Delete comment")}
                      disabled={del.isPending}
                      onClick={() => {
                        if (window.confirm(t("Delete this comment?"))) del.mutate(comment.id);
                      }}
                      className="grid size-8 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={t("Report comment")}
                      disabled={flag.isPending}
                      onClick={() => {
                        if (window.confirm(t("Report this comment to the Evoluir+ team?")))
                          flag.mutate(comment.id);
                      }}
                      className="grid size-8 shrink-0 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                    >
                      <Flag className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 p-3">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder={t("Add a comment...")}
            aria-label={t("Add a comment...")}
            className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm placeholder:text-white/40 focus:border-white/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || send.isPending}
            aria-label={t("Send")}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>
        <p className="px-4 pb-2 text-[11px] text-white/45">
          {t("Others see your first name and initial. No links or contact details.")}
        </p>
      </div>
    </div>
  );
}

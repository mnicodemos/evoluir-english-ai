import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearLessonVideo, getLessonVideos, setLessonVideo } from "@/lib/admin.functions";
import type { LessonVideoReportItem } from "@/lib/lessonVideoReport";
import { cn } from "@/lib/utils";

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
type Level = (typeof LEVELS)[number];

const SKILL_LABEL: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  talking: "Speaking",
  writing: "Writing",
  vocabulary: "Vocabulário",
  grammar: "Gramática",
};

/** "4:30" → 270; "" → null; anything else → undefined (invalid). */
function parseDuration(text: string): number | null | undefined {
  const clean = text.trim();
  if (!clean) return null;
  const match = clean.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return undefined;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : undefined;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "duração ?";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Title and channel from YouTube's public oEmbed, read by the owner's browser. */
function useVideoInfo(id: string) {
  return useQuery({
    queryKey: ["admin", "video-info", id],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const response = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      );
      if (!response.ok) return null;
      return (await response.json()) as { title?: string; author_name?: string };
    },
  });
}

function VideoTile({
  id,
  seconds,
  note,
  children,
}: {
  id: string;
  seconds: number | null;
  note?: string;
  children?: React.ReactNode;
}) {
  const info = useVideoInfo(id).data;
  return (
    <div className="flex gap-3 rounded-lg border border-border p-2">
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noreferrer"
        className="relative shrink-0"
      >
        <img
          src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
          alt=""
          className="h-[68px] w-[120px] rounded-md object-cover"
          loading="lazy"
        />
        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] text-white">
          {formatDuration(seconds)}
        </span>
      </a>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium">{info?.title ?? `Vídeo ${id}`}</p>
        <p className="truncate text-xs text-muted-foreground">
          {info?.author_name ?? "Canal não identificado"}
          {note ? ` · ${note}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <a
            href={`https://www.youtube.com/watch?v=${id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
          >
            <ExternalLink className="size-3" aria-hidden="true" /> Abrir
          </a>
          {children}
        </div>
      </div>
    </div>
  );
}

function LessonRow({ item, level }: { item: LessonVideoReportItem; level: Level }) {
  const queryClient = useQueryClient();
  const save = useServerFn(setLessonVideo);
  const clear = useServerFn(clearLessonVideo);
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("");
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin", "lesson-videos", level] });
  const approve = useMutation({
    mutationFn: (input: { url: string; seconds: number | null }) =>
      save({ data: { key: item.key, ...input } }),
    onSuccess: () => {
      setUrl("");
      setDuration("");
      toast.success("Vídeo aprovado: todos os alunos desta lição passam a vê-lo.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o vídeo."),
  });
  const remove = useMutation({
    mutationFn: () => clear({ data: { key: item.key } }),
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível remover a aprovação."),
  });
  const typedSeconds = parseDuration(duration);

  return (
    <li
      className={cn(
        "rounded-xl border p-3",
        item.approved ? "border-brand-green/40 bg-brand-green/[0.04]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs font-semibold text-muted-foreground">
          U{item.unit} · L{item.position}
        </span>
        <span className="text-sm font-semibold">{item.title}</span>
        <span className="text-xs text-muted-foreground">
          · {SKILL_LABEL[item.skill] ?? item.skill}
        </span>
        {item.approved ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-green/15 px-2 py-0.5 text-[11px] font-semibold text-brand-green">
            <Check className="size-3" aria-hidden="true" /> Aprovado
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{item.objective}</p>

      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        {item.approved ? (
          <VideoTile id={item.approved.id} seconds={item.approved.seconds} note="aprovado">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remover aprovação
            </button>
          </VideoTile>
        ) : null}
        {item.used
          .filter((video) => video.id !== item.approved?.id)
          .slice(0, 4)
          .map((video) => (
            <VideoTile
              key={video.id}
              id={video.id}
              seconds={video.seconds}
              note={`${video.lessons} ${video.lessons === 1 ? "aluno" : "alunos"}`}
            >
              <button
                type="button"
                className="text-xs font-semibold text-brand-green hover:underline"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ url: video.url, seconds: video.seconds })}
              >
                Aprovar este
              </button>
            </VideoTile>
          ))}
        {!item.approved && item.used.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum aluno abriu esta lição ainda: aprove um vídeo antes do primeiro.
          </p>
        ) : null}
      </div>

      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!url.trim() || typedSeconds === undefined) return;
          approve.mutate({ url, seconds: typedSeconds });
        }}
      >
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Colar link do YouTube"
          aria-label={`Link do vídeo para ${item.title}`}
          className="h-8 min-w-[14rem] flex-1 text-xs"
        />
        <Input
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          placeholder="mm:ss"
          aria-label="Duração do vídeo"
          className={cn("h-8 w-20 text-xs", typedSeconds === undefined && "border-destructive")}
        />
        <Button
          type="submit"
          size="sm"
          className="h-8"
          disabled={!url.trim() || typedSeconds === undefined || approve.isPending}
        >
          {approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {item.approved ? "Trocar" : "Aprovar"}
        </Button>
      </form>
    </li>
  );
}

/**
 * Admin → Vídeos (owner request, 2026-10-25: audit whether each lesson's video
 * matches its level and topic): per level, every curriculum lesson with the
 * video approved for it and the videos students actually got, with their
 * thumbnail, title and channel; approving one (or pasting a link) gives every
 * student of that lesson the same video.
 */
export function AdminLessonVideos() {
  const [level, setLevel] = useState<Level>("a1");
  const load = useServerFn(getLessonVideos);
  const query = useQuery({
    queryKey: ["admin", "lesson-videos", level],
    queryFn: () => load({ data: { level } }),
  });
  const lessons = query.data?.lessons ?? [];
  const approvedCount = lessons.filter((item) => item.approved).length;
  const units = [...new Set(lessons.map((item) => item.unit))];

  return (
    <section
      className="mt-4 rounded-xl border border-border p-3 sm:p-4"
      aria-label="Vídeos das lições"
    >
      <p className="text-sm font-semibold">Vídeos das lições</p>
      <p className="text-xs text-muted-foreground">
        Confira se o vídeo de cada lição combina com o tema e o nível. Aprove um vídeo e todos os
        alunos daquela lição passam a ver o mesmo; sem aprovação, o app busca um no YouTube.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {LEVELS.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLevel(code)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase",
              code === level
                ? "border-brand-green bg-brand-green/15 text-brand-green"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {code}
          </button>
        ))}
        {query.data ? (
          <span className="ml-auto self-center text-xs text-muted-foreground">
            {approvedCount} de {lessons.length} lições com vídeo aprovado
          </span>
        ) : null}
      </div>

      {query.data && !query.data.migrationApplied ? (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs">
          A migração 0081_lesson_videos ainda não foi aplicada: você já pode ver os vídeos que os
          alunos receberam, mas aprovar só funciona depois de aplicá-la pelo chat do Lovable.
        </p>
      ) : null}

      {query.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando
        </div>
      ) : query.isError ? (
        <p className="mt-3 text-sm text-muted-foreground">Não foi possível carregar os vídeos.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {units.map((unit) => {
            const unitLessons = lessons.filter((item) => item.unit === unit);
            return (
              <div key={unit}>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {unitLessons[0]?.unitTitle}
                </p>
                <ul className="mt-2 space-y-2">
                  {unitLessons.map((item) => (
                    <LessonRow key={item.key} item={item} level={level} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearLessonVideo, getLessonVideos, setLessonVideo } from "@/lib/admin.functions";
import type { LessonVideoReportItem } from "@/lib/lessonVideoReport";
import { cn } from "@/lib/utils";

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "business"] as const;
type Level = (typeof LEVELS)[number];

const SKILLS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  talking: "Speaking",
  writing: "Writing",
  vocabulary: "Vocabulário",
  grammar: "Gramática",
};

function LessonRow({ item, level }: { item: LessonVideoReportItem; level: Level }) {
  const queryClient = useQueryClient();
  const save = useServerFn(setLessonVideo);
  const clear = useServerFn(clearLessonVideo);
  const [url, setUrl] = useState("");
  const currentUrl = item.approved?.url ?? item.used[0]?.url ?? null;
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin", "lesson-videos", level] });

  const saveMutation = useMutation({
    mutationFn: () => save({ data: { key: item.key, url: url.trim(), seconds: null } }),
    onSuccess: () => {
      setUrl("");
      toast.success("Link do Vimeo salvo.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o link."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => clear({ data: { key: item.key } }),
    onSuccess: () => {
      toast.success("Vídeo removido.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o vídeo."),
  });

  return (
    <li
      className={cn(
        "rounded-xl border p-3",
        currentUrl ? "border-brand-green/40 bg-brand-green/[0.04]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-semibold text-muted-foreground">
          U{item.unit} · L{item.position}
        </span>
        <span className="text-sm font-semibold">{item.title}</span>
        <span className="text-xs text-muted-foreground">· {SKILLS[item.skill] ?? item.skill}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold",
            currentUrl ? "bg-brand-green/15 text-brand-green" : "bg-secondary text-muted-foreground",
          )}
        >
          {currentUrl ? "Com vídeo" : "Sem vídeo"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{item.objective}</p>

      {currentUrl ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
          <Video className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 break-all text-xs text-sky-300 hover:underline"
          >
            {currentUrl}
          </a>
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            <ExternalLink className="size-3" aria-hidden="true" /> Abrir
          </a>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm("Apagar o vídeo desta lição?")) deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Apagar
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhum vídeo cadastrado para esta lição.
        </p>
      )}

      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (url.trim()) saveMutation.mutate();
        }}
      >
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          type="url"
          placeholder={currentUrl ? "Novo link do Vimeo para substituir" : "Cole o link do Vimeo"}
          aria-label={`Link do Vimeo para ${item.title}`}
          className="h-9 min-w-[16rem] flex-1 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          className="h-9"
          disabled={!url.trim() || saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {currentUrl ? "Alterar vídeo" : "Adicionar vídeo"}
        </Button>
      </form>
    </li>
  );
}

/** Admin can audit and maintain the Vimeo link for every lesson without code changes. */
export function AdminLessonVideos() {
  const [level, setLevel] = useState<Level>("a1");
  const load = useServerFn(getLessonVideos);
  const query = useQuery({
    queryKey: ["admin", "lesson-videos", level],
    queryFn: () => load({ data: { level } }),
  });
  const lessons = query.data?.lessons ?? [];
  const units = [...new Set(lessons.map((item) => item.unit))];
  const count = lessons.filter((item) => item.approved || item.used.length > 0).length;

  return (
    <section
      className="mt-4 rounded-xl border border-border p-3 sm:p-4"
      aria-label="Gestão de vídeos das lições"
    >
      <p className="text-sm font-semibold">Vídeos das lições</p>
      <p className="text-xs text-muted-foreground">
        Consulte todas as lições e gerencie os links do Vimeo. Adicionar, alterar ou apagar aqui
        atualiza o vídeo exibido aos alunos na aba Summary, sem precisar editar código ou abrir PR
        para a gestão diária.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
            {code === "business" ? "Business" : code}
          </button>
        ))}
        {query.data ? (
          <span className="ml-auto self-center text-xs text-muted-foreground">
            {count} com vídeo · {lessons.length - count} sem vídeo · {lessons.length} lições
          </span>
        ) : null}
      </div>

      {query.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando lições…
        </div>
      ) : query.isError ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Não foi possível carregar as lições e os vídeos.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {units.map((unit) => {
            const group = lessons.filter((item) => item.unit === unit);
            return (
              <div key={unit}>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {group[0]?.unitTitle}
                </p>
                <ul className="mt-2 space-y-2">
                  {group.map((item) => (
                    <LessonRow key={item.key} item={item} level={level} />
                  ))}
                </ul>
              </div>
            );
          })}
          {lessons.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nenhuma lição encontrada neste nível.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

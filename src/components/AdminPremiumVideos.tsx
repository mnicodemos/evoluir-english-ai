import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Loader2, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deletePremiumVideo, getPremiumVideosAdmin, savePremiumVideo } from "@/lib/admin.functions";
import { getCurriculum } from "@/lib/curriculum";
import { premiumVideoList } from "@/lib/premiumVideos";

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;

/**
 * Admin → Conteúdo: Premium extra videos (owner request, 2026-10-31), one
 * Vimeo video per lesson of the path, listed for Premium students on their
 * own page (/learning/videos). Free students see the list with locks.
 */
export function AdminPremiumVideos() {
  const queryClient = useQueryClient();
  const fetchVideos = useServerFn(getPremiumVideosAdmin);
  const save = useServerFn(savePremiumVideo);
  const remove = useServerFn(deletePremiumVideo);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("a1");
  const [key, setKey] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const query = useQuery({
    queryKey: ["admin-premium-videos"],
    queryFn: () => fetchVideos(),
    retry: false,
  });
  const lessons = useMemo(
    () => getCurriculum(level).filter((lesson) => !lesson.isReviewTest),
    [level],
  );
  const saved = useMemo(
    () => premiumVideoList(query.data?.videos ?? [], true),
    [query.data?.videos],
  );
  const savedKeys = new Set(saved.map((video) => video.key));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-premium-videos"] });
    await queryClient.invalidateQueries({ queryKey: ["premium-videos"] });
  };
  const saveMutation = useMutation({
    mutationFn: () => save({ data: { key, url, title: title.trim() || undefined } }),
    onSuccess: async () => {
      await refresh();
      setUrl("");
      setTitle("");
      toast.success("Vídeo extra salvo.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const deleteMutation = useMutation({
    mutationFn: (videoKey: string) => remove({ data: { key: videoKey } }),
    onSuccess: refresh,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover."),
  });

  const field = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm";

  return (
    <section className="card-soft mt-2 space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
          <Crown className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold">Vídeos extras (Premium)</h2>
          <p className="text-sm text-muted-foreground">
            Um vídeo do Vimeo por lição da trilha. Aparecem na página "Vídeos extras" (Aprendizado),
            por nível e unidade; só alunos Premium assistem, os gratuitos veem a lista com cadeado e
            o convite para o Premium. Não contam no checklist, no dia de estudo nem no Teste Final.
          </p>
        </div>
      </div>

      {query.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </p>
      ) : query.data?.missingMigration ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Aplique a migração <code>0100_premium_lesson_videos.sql</code> pelo chat do Lovable para
          cadastrar os vídeos.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              aria-label="Nível"
              className={field}
              value={level}
              onChange={(event) => {
                setLevel(event.target.value as (typeof LEVELS)[number]);
                setKey("");
              }}
            >
              {LEVELS.map((value) => (
                <option key={value} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              aria-label="Lição"
              className={field}
              value={key}
              onChange={(event) => setKey(event.target.value)}
            >
              <option value="">Escolha a lição…</option>
              {lessons.map((lesson) => (
                <option key={lesson.key} value={lesson.key}>
                  U{lesson.unit} · L{lesson.position} — {lesson.title}
                  {savedKeys.has(lesson.key) ? " ●" : ""}
                </option>
              ))}
            </select>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://vimeo.com/123456789"
              aria-label="Link do Vimeo"
              className={field}
            />
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título (opcional)"
              aria-label="Título do vídeo"
              maxLength={120}
              className={field}
            />
            <Button
              size="sm"
              className="h-9 gap-1.5"
              disabled={saveMutation.isPending || !key || url.trim().length < 10}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Salvar numa lição que já tem vídeo (●) troca o vídeo dela. Sem título, a página usa o
            nome da lição.
          </p>

          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vídeo extra cadastrado ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {saved.map((video) => (
                <li
                  key={video.key}
                  className="grid gap-2 rounded-lg border border-border/60 p-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {video.level.toUpperCase()} · U{video.unit} · L{video.position}
                    </span>{" "}
                    — {video.title}
                    <a
                      href={video.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-brand-green underline-offset-2 hover:underline"
                    >
                      {video.url}
                    </a>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 justify-self-start text-destructive hover:text-destructive sm:justify-self-end"
                    disabled={deleteMutation.isPending}
                    aria-label={`Remover vídeo extra: ${video.title}`}
                    onClick={() => {
                      if (window.confirm(`Remover o vídeo extra "${video.title}"?`))
                        deleteMutation.mutate(video.key);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

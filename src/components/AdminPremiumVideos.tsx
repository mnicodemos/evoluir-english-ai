import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Loader2, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deletePremiumVideo, getPremiumVideosAdmin, savePremiumVideo } from "@/lib/admin.functions";
import { PREMIUM_VIDEO_LEVELS, premiumVideoList } from "@/lib/premiumVideos";

const LEVELS = PREMIUM_VIDEO_LEVELS;

/**
 * Admin → Conteúdo: Premium extra videos (owner decision, 2026-10-31: by
 * level only, not tied to a unit or lesson): any number of Vimeo videos per
 * level, each with its title, listed for Premium students on /learning/videos.
 * Free students see the list with locks.
 */
export function AdminPremiumVideos() {
  const queryClient = useQueryClient();
  const fetchVideos = useServerFn(getPremiumVideosAdmin);
  const save = useServerFn(savePremiumVideo);
  const remove = useServerFn(deletePremiumVideo);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("a1");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"video" | "short">("video");

  const query = useQuery({
    queryKey: ["admin-premium-videos"],
    queryFn: () => fetchVideos(),
    retry: false,
  });
  const saved = useMemo(
    () => premiumVideoList(query.data?.videos ?? [], true),
    [query.data?.videos],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-premium-videos"] });
    await queryClient.invalidateQueries({ queryKey: ["premium-videos"] });
  };
  const saveMutation = useMutation({
    mutationFn: () => save({ data: { level, url, title: title.trim(), kind } }),
    onSuccess: async (result) => {
      await refresh();
      setUrl("");
      setTitle("");
      toast.success(
        result.notified === null
          ? "Vídeo extra salvo."
          : `Short salvo. Notificação enviada a ${result.notified} aparelho(s) de alunos do nível.`,
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
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
            Vídeos do Vimeo por nível, quantos quiser, cada um com o seu título (sem ligação com
            unidade ou lição). Aparecem na página "Vídeos extras" (Aprendizado); só alunos Premium
            assistem, os gratuitos veem a lista com cadeado e o convite para o Premium. Não contam
            no checklist, no dia de estudo nem no Teste Final.
          </p>
        </div>
      </div>

      {query.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </p>
      ) : query.data?.missingMigration ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Aplique a migração <code>0101_premium_level_videos.sql</code> pelo chat do Lovable para
          cadastrar os vídeos.
        </p>
      ) : (
        <>
          {query.data && !query.data.kindReady ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              Para cadastrar Shorts, aplique a migração <code>0102_premium_video_kind.sql</code>{" "}
              pelo chat do Lovable. Os vídeos normais funcionam sem ela.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[6rem_7rem_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <select
              aria-label="Nível"
              className={field}
              value={level}
              onChange={(event) => setLevel(event.target.value as (typeof LEVELS)[number])}
            >
              {LEVELS.map((value) => (
                <option key={value} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              aria-label="Tipo"
              className={field}
              value={kind}
              onChange={(event) => setKind(event.target.value as "video" | "short")}
            >
              <option value="video">Vídeo</option>
              <option value="short">Short / Reel</option>
            </select>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={
                kind === "short"
                  ? "Vimeo ou https://www.instagram.com/reel/…"
                  : "https://vimeo.com/123456789"
              }
              aria-label={kind === "short" ? "Link do Vimeo ou do Reel" : "Link do Vimeo"}
              className={field}
            />
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título do vídeo"
              aria-label="Título do vídeo"
              maxLength={120}
              className={field}
            />
            <Button
              size="sm"
              className="h-9 gap-1.5"
              disabled={saveMutation.isPending || !title.trim() || url.trim().length < 10}
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
            Os vídeos aparecem na ordem em que foram cadastrados. Shorts são vídeos verticais
            (9:16): um vídeo do Vimeo ou um Reel público do Instagram, e ficam na aba "Shorts" da
            página. Para trocar um vídeo, remova e cadastre de novo.
          </p>

          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vídeo extra cadastrado ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {saved.map((video) => (
                <li
                  key={video.id}
                  className="grid gap-2 rounded-lg border border-border/60 p-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{video.level.toUpperCase()}</span>
                    {video.kind === "short" ? (
                      <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                        SHORT
                      </span>
                    ) : null}{" "}
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
                        deleteMutation.mutate(video.id);
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

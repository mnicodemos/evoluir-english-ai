import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Crown, Loader2, Pencil, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deletePremiumVideo,
  deletePremiumShortCaption,
  getPremiumShortCaptionsAdmin,
  savePremiumShortCaption,
  getPremiumVideosAdmin,
  notifyPremiumShort,
  savePremiumVideo,
  setPremiumVideoKind,
  updatePremiumVideo,
} from "@/lib/admin.functions";
import type { NewShortPushResult } from "@/lib/newShortPush";
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
  // Shorts are what the owner adds most now, so the form starts on them
  // (owner report, 2026-10-31: a short saved as "Vídeo" sent no push).
  const [kind, setKind] = useState<"video" | "short">("short");
  const [editing, setEditing] = useState<{
    id: string;
    level: (typeof LEVELS)[number];
    title: string;
    url: string;
    kind: "video" | "short";
    sortOrder: number;
  } | null>(null);
  const update = useServerFn(updatePremiumVideo);

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
      if (!result.push) toast.success("Vídeo extra salvo.");
      else showPushResult(result.push, "Short salvo.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Selecione um vídeo.");
      return update({ data: editing });
    },
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      toast.success("Vídeo atualizado e ordem salva.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."),
  });
  const notify = useServerFn(notifyPremiumShort);
  const notifyMutation = useMutation({
    mutationFn: (id: string) => notify({ data: { id } }),
    onSuccess: (push) => showPushResult(push, "Aviso do Short."),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível notificar."),
  });
  const changeKind = useServerFn(setPremiumVideoKind);
  const kindMutation = useMutation({
    mutationFn: (input: { id: string; kind: "video" | "short" }) => changeKind({ data: input }),
    onSuccess: async (result) => {
      await refresh();
      if (result.push) showPushResult(result.push, "Agora é Short.");
      else toast.success("Agora é vídeo.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível mudar o tipo."),
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
            Defina a posição de cada item ao editar. A ordem é independente para Shorts e Vídeos
            extras. Shorts são vídeos verticais (9:16): um vídeo do Vimeo ou um Reel público do
            Instagram, e ficam na aba "Shorts" da página. Você pode editar título, link, nível, tipo
            e posição sem excluir o cadastro.
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
                  <div className="min-w-0 space-y-2">
                    <div>
                      <span className="font-semibold">{video.level.toUpperCase()}</span>
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                        #{video.sortOrder || "—"}
                      </span>
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
                    </div>
                    {editing?.id === video.id ? (
                      <div className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[5rem_7rem_minmax(0,1fr)_minmax(0,1fr)_5rem_auto]">
                        <select
                          className={field}
                          value={editing.level}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              level: event.target.value as (typeof LEVELS)[number],
                            })
                          }
                        >
                          {LEVELS.map((value) => (
                            <option key={value} value={value}>
                              {value.toUpperCase()}
                            </option>
                          ))}
                        </select>
                        <select
                          className={field}
                          value={editing.kind}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              kind: event.target.value as "video" | "short",
                            })
                          }
                        >
                          <option value="video">Vídeo</option>
                          <option value="short">Short</option>
                        </select>
                        <input
                          className={field}
                          aria-label="Link do vídeo"
                          value={editing.url}
                          onChange={(event) => setEditing({ ...editing, url: event.target.value })}
                        />
                        <input
                          className={field}
                          aria-label="Título"
                          maxLength={120}
                          value={editing.title}
                          onChange={(event) =>
                            setEditing({ ...editing, title: event.target.value })
                          }
                        />
                        <input
                          className={field}
                          aria-label="Posição na lista"
                          type="number"
                          min={1}
                          max={9999}
                          value={editing.sortOrder}
                          onChange={(event) =>
                            setEditing({
                              ...editing,
                              sortOrder: Number(event.target.value),
                            })
                          }
                        />
                        <span className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-9"
                            disabled={
                              updateMutation.isPending ||
                              !editing.title.trim() ||
                              !editing.url.trim() ||
                              editing.sortOrder < 1
                            }
                            onClick={() => updateMutation.mutate()}
                          >
                            <Save className="size-4" /> Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9"
                            onClick={() => setEditing(null)}
                          >
                            Cancelar
                          </Button>
                        </span>
                        {editing.kind === "short" ? (
                          <ShortCaptionEditor videoId={editing.id} field={field} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <span className="flex items-center gap-1 justify-self-start sm:justify-self-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() =>
                        setEditing({
                          id: video.id,
                          level: video.level,
                          title: video.title,
                          url: video.url ?? "",
                          kind: video.kind,
                          sortOrder: video.sortOrder || 1,
                        })
                      }
                    >
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                    {query.data?.kindReady ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        disabled={kindMutation.isPending}
                        title={
                          video.kind === "short"
                            ? "Mudar para vídeo comum (aba Videos)"
                            : "Mudar para Short (aba Shorts) e notificar os alunos do nível"
                        }
                        onClick={() =>
                          kindMutation.mutate({
                            id: video.id,
                            kind: video.kind === "short" ? "video" : "short",
                          })
                        }
                      >
                        {video.kind === "short" ? "Virar vídeo" : "Virar Short"}
                      </Button>
                    ) : null}
                    {video.kind === "short" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5"
                        disabled={notifyMutation.isPending}
                        aria-label={`Notificar os alunos do nível: ${video.title}`}
                        title="Enviar a notificação deste Short aos alunos do nível"
                        onClick={() => notifyMutation.mutate(video.id)}
                      >
                        <Bell className="size-4" />
                        Notificar
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      aria-label={`Remover vídeo extra: ${video.title}`}
                      onClick={() => {
                        if (window.confirm(`Remover o vídeo extra "${video.title}"?`))
                          deleteMutation.mutate(video.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** What happened to a short's push, so the owner sees why nobody got it. */
function ShortCaptionEditor({ videoId, field }: { videoId: string; field: string }) {
  const fetchCaptions = useServerFn(getPremiumShortCaptionsAdmin);
  const saveCaption = useServerFn(savePremiumShortCaption);
  const removeCaption = useServerFn(deletePremiumShortCaption);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-short-captions", videoId],
    queryFn: () => fetchCaptions({ data: { videoId } }),
    retry: false,
  });
  const [en, setEn] = useState<string | null>(null);
  const [pt, setPt] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<16 | 20 | 24>(20);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const rows = query.data?.captions ?? [];
  useEffect(() => {
    if (query.data?.fontSize) setFontSize(query.data.fontSize as 16 | 20 | 24);
    if (query.data?.textColor) setTextColor(query.data.textColor);
    if (query.data?.backgroundColor) setBackgroundColor(query.data.backgroundColor);
  }, [query.data?.fontSize, query.data?.textColor, query.data?.backgroundColor]);
  const values = {
    en: en ?? rows.find((row) => row.language === "en")?.vtt_content ?? "",
    pt: pt ?? rows.find((row) => row.language === "pt")?.vtt_content ?? "",
  };
  const setters = { en: setEn, pt: setPt };
  const save = useMutation({
    mutationFn: (value: { language: "en" | "pt"; content: string }) =>
      saveCaption({ data: { videoId, ...value, fontSize, textColor, backgroundColor } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-short-captions", videoId] });
      toast.success("Legenda salva.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao salvar legenda."),
  });
  const remove = useMutation({
    mutationFn: (language: "en" | "pt") => removeCaption({ data: { videoId, language } }),
    onSuccess: async () => {
      setEn(null);
      setPt(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-short-captions", videoId] });
      toast.success("Legenda removida.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao remover legenda."),
  });
  return (
    <div className="mt-2 grid w-full min-w-0 gap-3 rounded-md border border-border/60 bg-background p-3 sm:col-span-full sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="text-sm font-semibold">Legendas do Short (WebVTT)</p>
        <p className="text-xs text-muted-foreground">
          Legendas vinculadas somente a este Short. Envie um arquivo .vtt ou edite o conteúdo
          abaixo.
        </p>
        {query.isPending ? <p className="text-xs text-muted-foreground">Carregando…</p> : null}
        {query.data?.missingMigration ? (
          <p className="text-xs text-warning">
            Aplique a migração 20261107180000_premium_video_captions.sql.
          </p>
        ) : null}
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold" htmlFor={`short-caption-size-${videoId}`}>
          Tamanho da legenda no vídeo
        </label>
        <select
          id={`short-caption-size-${videoId}`}
          className={field + " w-36"}
          value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value) as 16 | 20 | 24)}
        >
          <option value={16}>Pequeno · 16 px</option>
          <option value={20}>Médio · 20 px</option>
          <option value={24}>Grande · 24 px</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold">
          Cor da fonte
          <input
            aria-label="Cor da fonte da legenda"
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-border bg-background p-1"
            value={textColor}
            onChange={(event) => setTextColor(event.target.value.toUpperCase())}
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          Cor do fundo
          <input
            aria-label="Cor de fundo da legenda"
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-border bg-background p-1"
            value={backgroundColor}
            onChange={(event) => setBackgroundColor(event.target.value.toUpperCase())}
          />
        </label>
        <span className="text-xs text-muted-foreground">
          Tamanho e cores são aplicados aos dois idiomas e salvos junto com cada legenda.
        </span>
      </div>
      {(["en", "pt"] as const).map((language) => (
        <div key={language} className="min-w-0 space-y-1.5">
          <label className="text-xs font-semibold">
            {language === "en" ? "English" : "Português"}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
            <Upload className="size-3.5" /> Enviar arquivo .vtt
            <input
              type="file"
              accept=".vtt,text/vtt"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 500_000) {
                  toast.error("O arquivo .vtt deve ter até 500 KB.");
                  event.target.value = "";
                  return;
                }
                const content = await file.text();
                const hasTiming =
                  /(?:^|\n)(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/m.test(
                    content,
                  );
                if (!content.startsWith("WEBVTT") || !hasTiming) {
                  toast.error("Arquivo inválido: selecione um WebVTT com marcações de tempo.");
                  event.target.value = "";
                  return;
                }
                (language === "en" ? setEn : setPt)(content);
                toast.success(`Arquivo ${file.name} carregado para prévia.`);
                event.target.value = "";
              }}
            />
          </label>
          <textarea
            className={field + " h-36 w-full min-w-0 py-2 font-mono text-xs"}
            value={values[language]}
            onChange={(event) => setters[language](event.target.value)}
            placeholder={"WEBVTT\\n\\n00:00:01.000 --> 00:00:03.000\\nCaption text"}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={save.isPending || values[language].trim().length < 20}
              onClick={() => save.mutate({ language, content: values[language] })}
            >
              Salvar legenda
            </Button>
            {rows.some((row) => row.language === language) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate(language)}
              >
                Remover
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function showPushResult(push: NewShortPushResult, prefix: string) {
  if (push.problem) toast.error(`${prefix} Notificação não enviada: ${push.problem}.`);
  else if (push.students === 0)
    toast.warning(`${prefix} Nenhum aluno está neste nível, então ninguém foi notificado.`);
  else if (push.devices === 0)
    toast.warning(
      `${prefix} ${push.students} aluno(s) no nível, mas nenhum ativou as notificações no aparelho.`,
    );
  else
    toast.success(
      `${prefix} Notificação enviada a ${push.sent} de ${push.devices} aparelho(s) (${push.students} aluno(s) do nível).`,
    );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Crown, Loader2, Pencil, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUiLang } from "@/lib/uiLang";
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
  const { lang } = useUiLang();
  const isPt = lang === "pt";
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
      if (!result.push) toast.success(isPt ? "Vídeo extra salvo." : "Extra video saved.");
      else showPushResult(result.push, isPt ? "Short salvo." : "Short saved.", isPt);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : isPt ? "Não foi possível salvar." : "Could not save."),
  });
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error(isPt ? "Selecione um vídeo." : "Select a video.");
      return update({ data: editing });
    },
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      toast.success(isPt ? "Vídeo atualizado e ordem salva." : "Video updated and order saved.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : isPt ? "Não foi possível atualizar." : "Could not update."),
  });
  const notify = useServerFn(notifyPremiumShort);
  const notifyMutation = useMutation({
    mutationFn: (id: string) => notify({ data: { id } }),
    onSuccess: (push) => showPushResult(push, isPt ? "Aviso do Short." : "Short notification.", isPt),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : isPt ? "Não foi possível notificar." : "Could not send notification."),
  });
  const changeKind = useServerFn(setPremiumVideoKind);
  const kindMutation = useMutation({
    mutationFn: (input: { id: string; kind: "video" | "short" }) => changeKind({ data: input }),
    onSuccess: async (result) => {
      await refresh();
      if (result.push) showPushResult(result.push, isPt ? "Agora é Short." : "Changed to Short.", isPt);
      else toast.success(isPt ? "Agora é vídeo." : "Changed to video.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : isPt ? "Não foi possível mudar o tipo." : "Could not change the type."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : isPt ? "Não foi possível remover." : "Could not delete."),
  });

  const field = "h-9 w-full rounded-md border border-border bg-background px-3 text-sm";

  return (
    <section className="card-soft mt-2 space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
          <Crown className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold">{isPt ? "Vídeos extras (Premium)" : "Extra videos (Premium)"}</h2>
          <p className="text-sm text-muted-foreground">
            {isPt ? 'Vídeos do Vimeo por nível, quantos quiser, cada um com o seu título (sem ligação com unidade ou lição). Aparecem na página "Vídeos extras" (Aprendizado); só alunos Premium assistem, os gratuitos veem a lista com cadeado e o convite para o Premium. Não contam no checklist, no dia de estudo nem no Teste Final.' : 'Add any number of Vimeo videos per level, each with its own title (not linked to a unit or lesson). They appear on the "Extra videos" page under Learning. Only Premium students can watch; Free students see the locked list and the Premium invitation. These videos do not count toward the checklist, study day, or Final Test.'}
          </p>
        </div>
      </div>

      {query.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {isPt ? "Carregando…" : "Loading…"}
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
              {isPt ? <>Para cadastrar Shorts, aplique a migração <code>0102_premium_video_kind.sql</code> pelo chat do Lovable. Os vídeos normais funcionam sem ela.</> : <>To add Shorts, apply migration <code>0102_premium_video_kind.sql</code> through Lovable chat. Regular videos work without it.</>}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[6rem_7rem_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
            <select
              aria-label={isPt ? "Nível" : "Level"}
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
              aria-label={isPt ? "Tipo" : "Type"}
              className={field}
              value={kind}
              onChange={(event) => setKind(event.target.value as "video" | "short")}
            >
              <option value="video">{isPt ? "Vídeo" : "Video"}</option>
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
              aria-label={kind === "short" ? (isPt ? "Link do Vimeo ou do Reel" : "Vimeo or Reel URL") : (isPt ? "Link do Vimeo" : "Vimeo URL")}
              className={field}
            />
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={isPt ? "Título do vídeo" : "Video title"}
              aria-label={isPt ? "Título do vídeo" : "Video title"}
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
              {isPt ? "Salvar" : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isPt ? 'Defina a posição de cada item ao editar. A ordem é independente para Shorts e Vídeos extras. Shorts são vídeos verticais (9:16): um vídeo do Vimeo ou um Reel público do Instagram, e ficam na aba "Shorts" da página. Você pode editar título, link, nível, tipo e posição sem excluir o cadastro.' : 'Set each item’s position when editing. Shorts and extra videos have independent ordering. Shorts are vertical (9:16) videos: either a Vimeo video or a public Instagram Reel, displayed in the page’s "Shorts" tab. You can edit the title, URL, level, type, and position without deleting the entry.'}
          </p>

          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isPt ? "Nenhum vídeo extra cadastrado ainda." : "No extra videos have been added yet."}</p>
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
                          <option value="video">{isPt ? "Vídeo" : "Video"}</option>
                          <option value="short">Short</option>
                        </select>
                        <input
                          className={field}
                          aria-label={isPt ? "Link do vídeo" : "Video URL"}
                          value={editing.url}
                          onChange={(event) => setEditing({ ...editing, url: event.target.value })}
                        />
                        <input
                          className={field}
                          aria-label={isPt ? "Título" : "Title"}
                          maxLength={120}
                          value={editing.title}
                          onChange={(event) =>
                            setEditing({ ...editing, title: event.target.value })
                          }
                        />
                        <input
                          className={field}
                          aria-label={isPt ? "Posição na lista" : "List position"}
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
                            <Save className="size-4" /> {isPt ? "Salvar" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9"
                            onClick={() => setEditing(null)}
                          >
                            {isPt ? "Cancelar" : "Cancel"}
                          </Button>
                        </span>
                        {editing.kind === "short" ? (
                          <ShortCaptionEditor videoId={editing.id} field={field} isPt={isPt} />
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
                      <Pencil className="size-3.5" /> {isPt ? "Editar" : "Edit"}
                    </Button>
                    {query.data?.kindReady ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        disabled={kindMutation.isPending}
                        title={
                          video.kind === "short"
                            ? isPt ? "Mudar para vídeo comum (aba Vídeos)" : "Change to regular video (Videos tab)"
                            : isPt ? "Mudar para Short (aba Shorts) e notificar os alunos do nível" : "Change to Short (Shorts tab) and notify students at this level"
                        }
                        onClick={() =>
                          kindMutation.mutate({
                            id: video.id,
                            kind: video.kind === "short" ? "video" : "short",
                          })
                        }
                      >
                        {video.kind === "short" ? (isPt ? "Virar vídeo" : "Make video") : (isPt ? "Virar Short" : "Make Short")}
                      </Button>
                    ) : null}
                    {video.kind === "short" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5"
                        disabled={notifyMutation.isPending}
                        aria-label={`${isPt ? "Notificar os alunos do nível" : "Notify students at this level"}: ${video.title}`}
                        title={isPt ? "Enviar a notificação deste Short aos alunos do nível" : "Send this Short notification to students at this level"}
                        onClick={() => notifyMutation.mutate(video.id)}
                      >
                        <Bell className="size-4" />
                        {isPt ? "Notificar" : "Notify"}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      aria-label={`${isPt ? "Remover vídeo extra" : "Delete extra video"}: ${video.title}`}
                      onClick={() => {
                        if (window.confirm(isPt ? `Remover o vídeo extra "${video.title}"?` : `Delete the extra video "${video.title}"?`))
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
function ShortCaptionEditor({ videoId, field, isPt }: { videoId: string; field: string; isPt: boolean }) {
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
  const [backgroundOpacity, setBackgroundOpacity] = useState(100);
  const rows = query.data?.captions ?? [];
  useEffect(() => {
    if (query.data?.fontSize) setFontSize(query.data.fontSize as 16 | 20 | 24);
    if (query.data?.textColor) setTextColor(query.data.textColor);
    if (query.data?.backgroundColor) setBackgroundColor(query.data.backgroundColor);
    if (query.data?.backgroundOpacity !== undefined)
      setBackgroundOpacity(query.data.backgroundOpacity);
  }, [
    query.data?.fontSize,
    query.data?.textColor,
    query.data?.backgroundColor,
    query.data?.backgroundOpacity,
  ]);
  const values = {
    en: en ?? rows.find((row) => row.language === "en")?.vtt_content ?? "",
    pt: pt ?? rows.find((row) => row.language === "pt")?.vtt_content ?? "",
  };
  const setters = { en: setEn, pt: setPt };
  const save = useMutation({
    mutationFn: (value: { language: "en" | "pt"; content: string }) =>
      saveCaption({
        data: { videoId, ...value, fontSize, textColor, backgroundColor, backgroundOpacity },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-short-captions", videoId] });
      toast.success(isPt ? "Legenda salva." : "Caption saved.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : isPt ? "Falha ao salvar legenda." : "Could not save caption."),
  });
  const remove = useMutation({
    mutationFn: (language: "en" | "pt") => removeCaption({ data: { videoId, language } }),
    onSuccess: async () => {
      setEn(null);
      setPt(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-short-captions", videoId] });
      toast.success(isPt ? "Legenda removida." : "Caption removed.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : isPt ? "Falha ao remover legenda." : "Could not remove caption."),
  });
  return (
    <div className="mt-2 grid w-full min-w-0 gap-3 rounded-md border border-border/60 bg-background p-3 sm:col-span-full sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="text-sm font-semibold">{isPt ? "Legendas do Short (WebVTT)" : "Short captions (WebVTT)"}</p>
        <p className="text-xs text-muted-foreground">
          {isPt ? "Legendas vinculadas somente a este Short. Envie um arquivo .vtt ou edite o conteúdo abaixo." : "Captions linked only to this Short. Upload a .vtt file or edit the content below."}
        </p>
        {query.isPending ? <p className="text-xs text-muted-foreground">{isPt ? "Carregando…" : "Loading…"}</p> : null}
        {query.data?.missingMigration ? (
          <p className="text-xs text-warning">
            {isPt ? "Aplique a migração" : "Apply migration"} 20261107180000_premium_video_captions.sql.
          </p>
        ) : null}
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold" htmlFor={`short-caption-size-${videoId}`}>
          {isPt ? "Tamanho da legenda no vídeo" : "Caption size"}
        </label>
        <select
          id={`short-caption-size-${videoId}`}
          className={field + " w-36"}
          value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value) as 16 | 20 | 24)}
        >
          <option value={16}>{isPt ? "Pequeno · 16 px" : "Small · 16 px"}</option>
          <option value={20}>{isPt ? "Médio · 20 px" : "Medium · 20 px"}</option>
          <option value={24}>{isPt ? "Grande · 24 px" : "Large · 24 px"}</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold">
          {isPt ? "Cor da fonte" : "Font color"}
          <input
            aria-label={isPt ? "Cor da fonte da legenda" : "Caption font color"}
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-border bg-background p-1"
            value={textColor}
            onChange={(event) => setTextColor(event.target.value.toUpperCase())}
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          {isPt ? "Cor do fundo" : "Background color"}
          <input
            aria-label={isPt ? "Cor de fundo da legenda" : "Caption background color"}
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-border bg-background p-1"
            value={backgroundColor}
            onChange={(event) => setBackgroundColor(event.target.value.toUpperCase())}
          />
        </label>
        <label className="flex min-w-52 flex-1 items-center gap-2 text-xs font-semibold">
          {isPt ? "Transparência do fundo" : "Background opacity"}
          <input
            aria-label={isPt ? "Transparência do fundo da legenda" : "Caption background opacity"}
            type="range"
            min={0}
            max={100}
            step={5}
            className="min-w-20 flex-1 accent-primary"
            value={backgroundOpacity}
            onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
          />
          <span className="w-10 text-right tabular-nums">{backgroundOpacity}%</span>
        </label>
        <span className="text-xs text-muted-foreground">
          {isPt ? "Tamanho, cores e transparência são aplicados aos dois idiomas e salvos junto com cada legenda." : "Size, colors, and opacity apply to both languages and are saved with each caption."}
        </span>
      </div>
      {(["en", "pt"] as const).map((language) => (
        <div key={language} className="min-w-0 space-y-1.5">
          <label className="text-xs font-semibold">
            {language === "en" ? "English" : "Português"}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
            <Upload className="size-3.5" /> {isPt ? "Enviar arquivo .vtt" : "Upload .vtt file"}
            <input
              type="file"
              accept=".vtt,text/vtt"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 500_000) {
                  toast.error(isPt ? "O arquivo .vtt deve ter até 500 KB." : "The .vtt file must be 500 KB or smaller.");
                  event.target.value = "";
                  return;
                }
                const content = await file.text();
                const hasTiming =
                  /(?:^|\n)(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}/m.test(
                    content,
                  );
                if (!content.startsWith("WEBVTT") || !hasTiming) {
                  toast.error(isPt ? "Arquivo inválido: selecione um WebVTT com marcações de tempo." : "Invalid file: select a WebVTT file with timestamps.");
                  event.target.value = "";
                  return;
                }
                (language === "en" ? setEn : setPt)(content);
                toast.success(isPt ? `Arquivo ${file.name} carregado para prévia.` : `File ${file.name} loaded for preview.`);
                event.target.value = "";
              }}
            />
          </label>
          <textarea
            className={field + " h-36 w-full min-w-0 py-2 font-mono text-xs"}
            value={values[language]}
            onChange={(event) => setters[language](event.target.value)}
            placeholder={"WEBVTT

00:00:01.000 --> 00:00:03.000
Caption text"}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={save.isPending || values[language].trim().length < 20}
              onClick={() => save.mutate({ language, content: values[language] })}
            >
              {isPt ? "Salvar legenda" : "Save captions"}
            </Button>
            {rows.some((row) => row.language === language) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate(language)}
              >
                {isPt ? "Remover" : "Remove"}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function showPushResult(push: NewShortPushResult, prefix: string, isPt: boolean) {
  if (push.problem) toast.error(isPt ? `${prefix} Notificação não enviada: ${push.problem}.` : `${prefix} Notification not sent: ${push.problem}.`);
  else if (push.students === 0)
    toast.warning(isPt ? `${prefix} Nenhum aluno está neste nível, então ninguém foi notificado.` : `${prefix} There are no students at this level, so nobody was notified.`);
  else if (push.devices === 0)
    toast.warning(
      isPt ? `${prefix} ${push.students} aluno(s) no nível, mas nenhum ativou as notificações no aparelho.` : `${prefix} ${push.students} student(s) at this level, but none enabled notifications on their device.`,
    );
  else
    toast.success(
      isPt ? `${prefix} Notificação enviada a ${push.sent} de ${push.devices} aparelho(s) (${push.students} aluno(s) do nível).` : `${prefix} Notification sent to ${push.sent} of ${push.devices} device(s) (${push.students} student(s) at this level).`,
    );
}

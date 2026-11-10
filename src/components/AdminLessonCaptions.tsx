import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useUiLang } from "@/lib/uiLang";
import {
  deleteLessonVideoCaption,
  getLessonVideoCaptionAdmin,
  getSummaryVideoLinks,
  saveLessonVideoCaption,
} from "@/lib/admin.functions";

const LEVELS = ["a1", "a2", "b1"] as const;
type Level = (typeof LEVELS)[number];
type Language = "en" | "pt";
type CaptionFile = { name: string; content: string };

export function AdminLessonCaptions() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const [level, setLevel] = useState<Level>("a1");
  const [lessonKey, setLessonKey] = useState("");
  const [files, setFiles] = useState<Partial<Record<Language, CaptionFile>>>({});
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();
  const getLinks = useServerFn(getSummaryVideoLinks);
  const getStatus = useServerFn(getLessonVideoCaptionAdmin);
  const save = useServerFn(saveLessonVideoCaption);
  const remove = useServerFn(deleteLessonVideoCaption);

  const lessonsQuery = useQuery({
    queryKey: ["admin-summary-video-links", level],
    queryFn: () => getLinks({ data: { level } }),
    retry: false,
  });
  const lessons = lessonsQuery.data ?? [];
  const selectedKey = lessons.some((lesson) => lesson.key === lessonKey)
    ? lessonKey
    : (lessons[0]?.key ?? "");

  useEffect(() => {
    if (selectedKey && selectedKey !== lessonKey) setLessonKey(selectedKey);
  }, [selectedKey, lessonKey]);

  const statusQuery = useQuery({
    queryKey: ["admin-lesson-caption-status", selectedKey],
    queryFn: () => getStatus({ data: { key: selectedKey } }),
    enabled: Boolean(selectedKey),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: ({ language, content }: { language: Language; content: string }) =>
      save({ data: { key: selectedKey, language, content } }),
    onSuccess: async (_result, variables) => {
      setFiles((current) => ({ ...current, [variables.language]: undefined }));
      setNotice(`${variables.language.toUpperCase()} caption uploaded.`);
      await queryClient.invalidateQueries({
        queryKey: ["admin-lesson-caption-status", selectedKey],
      });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Caption upload failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (language: Language) => remove({ data: { key: selectedKey, language } }),
    onSuccess: async (_result, language) => {
      setNotice(`${language.toUpperCase()} caption removed.`);
      await queryClient.invalidateQueries({
        queryKey: ["admin-lesson-caption-status", selectedKey],
      });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Caption removal failed."),
  });

  async function chooseFile(language: Language, file?: File) {
    setNotice("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vtt") && file.type !== "text/vtt") {
      setNotice(pt ? "Selecione um arquivo .vtt." : "Select a .vtt file.");
      return;
    }
    if (file.size > 500_000) {
      setNotice(pt ? "O arquivo deve ter no máximo 500 KB." : "The file must be no larger than 500 KB.");
      return;
    }
    const content = await file.text();
    if (!content.startsWith("WEBVTT")) {
      setNotice(pt ? "O arquivo selecionado não é um WebVTT válido." : "The selected file is not valid WebVTT.");
      return;
    }
    setFiles((current) => ({ ...current, [language]: { name: file.name, content } }));
  }

  const languages = statusQuery.data?.languages ?? [];
  const field = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";

  return (
    <section className="card-soft mt-3 space-y-4 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-green/15 text-brand-green">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold">{pt ? "Legendas personalizadas (A1–B1)" : "Custom captions (A1–B1)"}</h2>
          <p className="text-sm text-muted-foreground">
            {pt ? "Envie faixas WebVTT em inglês e português por aula. O aluno verá as legendas dentro do player, com tamanho inicial de 75% e controles próprios, sem depender do CC do Vimeo." : "Upload English and Portuguese WebVTT tracks for each lesson. Students will see captions inside the player, initially sized at 75%, with their own controls and without relying on Vimeo CC."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          {pt ? "Nível" : "Level"}
          <select
            className={field}
            value={level}
            onChange={(event) => {
              setLevel(event.target.value as Level);
              setLessonKey("");
              setFiles({});
              setNotice("");
            }}
          >
            {LEVELS.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Aula
          <select
            className={field}
            value={selectedKey}
            onChange={(event) => {
              setLessonKey(event.target.value);
              setFiles({});
              setNotice("");
            }}
          >
            {lessons.map((lesson) => (
              <option key={lesson.key} value={lesson.key}>
                Unit {lesson.unit} · Lesson {lesson.position} — {lesson.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {lessonsQuery.isPending || statusQuery.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {pt ? "Carregando aulas e legendas…" : "Loading lessons and captions…"}
        </p>
      ) : lessonsQuery.isError ? (
        <p className="text-sm text-destructive">{pt ? "Não foi possível carregar as aulas deste nível." : "Could not load lessons for this level."}</p>
      ) : statusQuery.data?.missingMigration ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          {pt ? <>Aplique a migração <code>20261107170000_lesson_video_captions.sql</code> para habilitar o envio das legendas.</> : <>Apply migration <code>20261107170000_lesson_video_captions.sql</code> to enable caption uploads.</>}
        </p>
      ) : selectedKey ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["en", "pt"] as const).map((language) => {
            const draft = files[language];
            const exists = languages.includes(language);
            const busy = saveMutation.isPending || deleteMutation.isPending;
            return (
              <div key={language} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {language === "en" ? "English" : "Português"}
                  </span>
                  <span
                    className={
                      exists ? "text-xs text-brand-green" : "text-xs text-muted-foreground"
                    }
                  >
                    {exists ? pt ? "Publicado" : "Published" : pt ? "Sem legenda" : "No captions"}
                  </span>
                </div>
                <label className="block text-xs text-muted-foreground">
                  {pt ? "Arquivo WebVTT (.vtt)" : "WebVTT file (.vtt)"}
                  <input
                    className="mt-1 block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2"
                    type="file"
                    accept=".vtt,text/vtt"
                    onChange={(event) => void chooseFile(language, event.target.files?.[0])}
                  />
                </label>
                {draft ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {draft.name} · {pt ? "pronto para enviar" : "ready to upload"}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!draft || busy}
                    onClick={() => {
                      if (draft) saveMutation.mutate({ language, content: draft.content });
                    }}
                  >
                    {saveMutation.isPending && saveMutation.variables?.language === language ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-1 size-4" />
                    )}
                    {pt ? "Enviar legenda" : "Upload captions"}
                  </Button>
                  {exists ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(`${pt ? "Remover a legenda" : "Remove the"} ${language.toUpperCase()} ${pt ? "desta aula?" : "captions for this lesson?"}`)
                        ) {
                          deleteMutation.mutate(language);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 size-4" /> {pt ? "Remover" : "Remove"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{pt ? "Nenhuma aula cadastrada para este nível." : "No lessons are configured for this level."}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {pt ? "Formato WebVTT · até 500 KB por idioma e aula. A legenda pode ser substituída a qualquer momento." : "WebVTT format · up to 500 KB per language and lesson. Captions can be replaced at any time."}
      </p>
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

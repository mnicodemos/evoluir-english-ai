import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AudioLines, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getLevelPodcastStatus, prepareLevelPodcasts } from "@/lib/admin.functions";
import { useUiLang } from "@/lib/uiLang";

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
type Level = (typeof LEVELS)[number];

/**
 * Admin → Conteúdo → Teste de lição: "Áudios das lições" (owner request,
 * 2026-10-31). Writes ahead the EVO and Leo dialogues a level's lessons still
 * lack, so no student waits for the AI when opening a lesson; each script is
 * the shared copy students get, and its voice is cached line by line as it plays.
 */
export function AdminLessonAudioPrep() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const queryClient = useQueryClient();
  const loadStatus = useServerFn(getLevelPodcastStatus);
  const prepare = useServerFn(prepareLevelPodcasts);
  const [level, setLevel] = useState<Level>("a1");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const status = useQuery({
    queryKey: ["admin-podcast-status", level],
    queryFn: () => loadStatus({ data: { level } }),
    retry: false,
  });

  const run = async () => {
    setRunning(true);
    setLog([]);
    try {
      // Two dialogues per call; keep calling until the level is ready or a call stops.
      for (let round = 0; round < 30; round += 1) {
        const result = await prepare({ data: { level } });
        queryClient.setQueryData(["admin-podcast-status", level], {
          total: result.total,
          ready: result.ready,
          missing: [],
        });
        if (result.failed.length) setLog((current) => [...current, ...result.failed]);
        if (result.done || (result.generated === 0 && result.failed.length)) break;
      }
    } catch (error) {
      setLog((current) => [
        ...current,
        error instanceof Error ? error.message : pt ? "Não foi possível preparar agora." : "Could not prepare the audio right now.",
      ]);
    } finally {
      setRunning(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-podcast-status", level] });
    }
  };

  const data = status.data;
  const done = !!data && data.ready === data.total;

  return (
    <section className="card-soft mb-4 space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
          <AudioLines className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold">{pt ? "Áudios das lições" : "Lesson audio"}</h2>
          <p className="text-sm text-muted-foreground">
            {pt
              ? "Prepare antecipadamente os diálogos da EVO com o Leo para as lições deste nível, evitando que os alunos esperem pela IA ao abrir uma lição. O roteiro é compartilhado com todos; a voz é gerada linha a linha na primeira reprodução e armazenada para uso posterior. Custo aproximado: US$ 0,01 por roteiro, uma única vez. Review I, Review II e o teste de revisão não têm áudio."
              : "Pre-generate EVO and Leo dialogues for this level so students do not wait for AI when opening a lesson. The prepared script is shared with all students; voice is generated line by line on first playback and cached for everyone. Approximate cost: US$0.01 per script, one time. Review I, Review II and the review test do not have audio."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={pt ? "Nível" : "Level"}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={level}
          disabled={running}
          onChange={(event) => {
            setLevel(event.target.value as Level);
            setLog([]);
          }}
        >
          {LEVELS.map((value) => (
            <option key={value} value={value}>
              {value.toUpperCase()}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="h-9 gap-1.5"
          disabled={running || status.isPending || done}
          onClick={() => void run()}
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {running ? (pt ? "Preparando…" : "Preparing…") : pt ? "Preparar áudios do nível" : "Prepare level audio"}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {status.isPending
            ? pt ? "Verificando…" : "Checking…"
            : status.isError
              ? pt ? "Não foi possível verificar." : "Could not check status."
              : data
                ? `${data.ready}/${data.total} prontos${done ? " ✓" : ""}`
                : null}
        </span>
      </div>

      {data && !running && data.missing.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{pt ? "Faltam" : "Missing"} {data.missing.length}</summary>
          <ul className="mt-1 space-y-0.5">
            {data.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {log.length ? (
        <ul className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          {log.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

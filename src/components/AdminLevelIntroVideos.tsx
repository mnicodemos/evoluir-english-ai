import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlayCircle, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteLevelIntroVideo,
  getLevelIntroVideos,
  saveLevelIntroVideo,
} from "@/lib/admin.functions";

const INTRO_LEVELS = [
  { value: "a1", label: "A1" },
  { value: "a2", label: "A2" },
  { value: "b1", label: "B1" },
  { value: "b2", label: "B2" },
  { value: "c1", label: "C1" },
  { value: "c2", label: "C2" },
  { value: "business", label: "Business English" },
] as const;

type IntroLevel = (typeof INTRO_LEVELS)[number]["value"];

/**
 * Admin → Conteúdo: one presentation video per level and one for Business
 * (owner request, 2026-10-31), shown as "Comece aqui" on top of the learning
 * path and of /business. Vimeo links only, like the Summary videos.
 */
export function AdminLevelIntroVideos() {
  const queryClient = useQueryClient();
  const fetchVideos = useServerFn(getLevelIntroVideos);
  const save = useServerFn(saveLevelIntroVideo);
  const remove = useServerFn(deleteLevelIntroVideo);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["admin-level-intro-videos"],
    queryFn: () => fetchVideos(),
    retry: false,
  });
  useEffect(() => {
    if (query.data) setDrafts(query.data.videos);
  }, [query.data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-level-intro-videos"] });
    await queryClient.invalidateQueries({ queryKey: ["level-intro-video"] });
  };
  const saveMutation = useMutation({
    mutationFn: (input: { level: IntroLevel; url: string }) => save({ data: input }),
    onSuccess: async () => {
      await refresh();
      toast.success("Vídeo de apresentação salvo.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });
  const deleteMutation = useMutation({
    mutationFn: (level: IntroLevel) => remove({ data: { level } }),
    onSuccess: async (_result, level) => {
      setDrafts((current) => ({ ...current, [level]: "" }));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover."),
  });

  return (
    <section className="card-soft mt-2 space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-green/15 text-brand-green">
          <PlayCircle className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold">Apresentação dos níveis</h2>
          <p className="text-sm text-muted-foreground">
            Um vídeo do Vimeo por nível e um para o Business English. Aparece como "Comece aqui" no
            topo da trilha do nível (e da página do Business) até o aluno marcar "Já assisti";
            depois fica numa linha que reabre o vídeo. É opcional: não conta no checklist, no dia de
            estudo nem no Teste Final.
          </p>
        </div>
      </div>
      {query.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </p>
      ) : query.data?.missingMigration ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Aplique a migração <code>0097_level_intro_videos.sql</code> pelo chat do Lovable para
          cadastrar os vídeos.
        </p>
      ) : (
        <ul className="space-y-2">
          {INTRO_LEVELS.map((item) => {
            const saved = query.data?.videos[item.value] ?? "";
            const draft = drafts[item.value] ?? "";
            const busy =
              (saveMutation.isPending && saveMutation.variables?.level === item.value) ||
              (deleteMutation.isPending && deleteMutation.variables === item.value);
            return (
              <li
                key={item.value}
                className="grid gap-2 rounded-lg border border-border/60 p-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="text-sm font-semibold">
                  {item.label}
                  {saved ? (
                    <span className="ml-2 text-[11px] font-medium text-brand-green">● no ar</span>
                  ) : null}
                </span>
                <input
                  type="url"
                  value={draft}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [item.value]: event.target.value }))
                  }
                  placeholder="https://vimeo.com/123456789"
                  aria-label={`Link do Vimeo: ${item.label}`}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                />
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-9 gap-1.5"
                    disabled={busy || !draft.trim() || draft.trim() === saved}
                    onClick={() => saveMutation.mutate({ level: item.value, url: draft })}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Salvar
                  </Button>
                  {saved ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 text-destructive hover:text-destructive"
                      disabled={busy}
                      aria-label={`Remover vídeo: ${item.label}`}
                      onClick={() => {
                        if (window.confirm(`Remover o vídeo de apresentação de ${item.label}?`))
                          deleteMutation.mutate(item.value);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

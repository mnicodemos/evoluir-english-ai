import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileAudio, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { listAdminPodcastScripts } from "@/lib/reviewPodcast.functions";

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "podcast";
}

function downloadText(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AdminPodcasts() {
  const list = useServerFn(listAdminPodcastScripts);
  const query = useQuery({
    queryKey: ["admin", "podcast-scripts"],
    queryFn: () => list(),
    retry: false,
  });

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Carregando podcasts disponíveis…
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-3 py-6">
        <p className="text-sm text-destructive">Não foi possível carregar os podcasts.</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  const scripts = query.data ?? [];

  return (
    <section className="space-y-4 py-4">
      <div>
        <h2 className="text-lg font-semibold">Podcasts das aulas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe os roteiros já gerados e salvos no sistema. Os arquivos MP3/MP4 não são criados por esta tela:
          o áudio atual é reproduzido por linhas de fala no aplicativo, e vídeos finais precisam ser importados
          ou integrados ao armazenamento antes de poderem ser baixados.
        </p>
      </div>

      {scripts.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Nenhum roteiro de podcast foi encontrado no armazenamento compartilhado ainda. Os roteiros aparecem aqui
          depois que forem gerados e salvos por uma aula.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{scripts.length} roteiro(s) disponível(is)</p>
          <ul className="space-y-2">
            {scripts.map((item) => {
              const filename = safeFilename(item.curriculumKey);
              const transcript = item.podcast.lines
                .map((line) => `${line.speaker.toUpperCase()}: ${line.text}\nPT: ${line.pt}`)
                .join("\n\n");
              return (
                <li key={`${item.curriculumKey}-${item.createdAt}`} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-green/10 text-brand-green">
                    <FileAudio className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.podcast.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.curriculumKey} · salvo em {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadText(`${filename}.txt`, transcript, "text/plain;charset=utf-8")}>
                      <Download className="size-4" aria-hidden="true" /> Baixar roteiro
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => downloadText(`${filename}.json`, JSON.stringify({ curriculumKey: item.curriculumKey, ...item.podcast }, null, 2), "application/json;charset=utf-8")}>
                      <Download className="size-4" aria-hidden="true" /> JSON
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, EyeOff, Flag, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteVideoCommentAdmin,
  getVideoCommentsAdmin,
  keepVideoCommentAdmin,
} from "@/lib/admin.functions";
import { HIDE_AFTER_REPORTS, hiddenByReports } from "@/lib/premiumVideoSocial";

/**
 * Admin → Conteúdo: comments on the Premium extra videos (migration 0103),
 * reported ones first, so the owner removes what does not belong.
 */
export function AdminVideoComments() {
  const queryClient = useQueryClient();
  const fetchComments = useServerFn(getVideoCommentsAdmin);
  const remove = useServerFn(deleteVideoCommentAdmin);
  const keep = useServerFn(keepVideoCommentAdmin);
  const query = useQuery({
    queryKey: ["admin-video-comments"],
    queryFn: () => fetchComments(),
    retry: false,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-video-comments"] });
      await queryClient.invalidateQueries({ queryKey: ["video-comments"] });
      await queryClient.invalidateQueries({ queryKey: ["video-social"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível remover."),
  });
  const keepMutation = useMutation({
    mutationFn: (id: string) => keep({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-video-comments"] });
      await queryClient.invalidateQueries({ queryKey: ["video-comments"] });
      await queryClient.invalidateQueries({ queryKey: ["video-social"] });
      toast.success("Comentário mantido: as denúncias foram limpas.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível manter."),
  });
  const comments = query.data?.comments ?? [];
  const reported = comments.filter((comment) => comment.reports > 0).length;

  return (
    <section className="card-soft mt-2 space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold">
            Comentários dos vídeos extras
            {reported ? (
              <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                {reported} denunciado{reported === 1 ? "" : "s"}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-muted-foreground">
            Os comentários aparecem na hora para os alunos Premium. Na primeira denúncia você recebe
            um push; com {HIDE_AFTER_REPORTS} denúncias o comentário fica oculto até você decidir:
            "Manter" limpa as denúncias e o devolve, a lixeira remove. Os alunos só veem o primeiro
            nome e a inicial, e links ou contatos são bloqueados.
          </p>
        </div>
      </div>

      {query.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar os comentários.</p>
      ) : query.data?.missingMigration ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Aplique a migração <code>0103_premium_video_social.sql</code> pelo chat do Lovable para
          ativar curtidas e comentários.
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
      ) : (
        <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={`grid gap-2 rounded-lg border p-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                comment.reports ? "border-destructive/50 bg-destructive/5" : "border-border/60"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{comment.author}</span> ·{" "}
                  {new Date(comment.createdAt).toLocaleString("pt-BR")} · {comment.video}
                  {comment.reports ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                      <Flag className="size-3" /> {comment.reports}
                    </span>
                  ) : null}
                  {hiddenByReports(comment.reports) ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                      <EyeOff className="size-3" /> Oculto
                    </span>
                  ) : null}
                </span>
                <span className="block break-words">{comment.body}</span>
              </span>
              <span className="flex items-center gap-1 justify-self-start sm:justify-self-end">
                {comment.reports ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1"
                    disabled={keepMutation.isPending}
                    onClick={() => keepMutation.mutate(comment.id)}
                  >
                    <Check className="size-4" /> Manter
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive"
                  disabled={deleteMutation.isPending}
                  aria-label="Remover comentário"
                  onClick={() => {
                    if (window.confirm("Remover este comentário?"))
                      deleteMutation.mutate(comment.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

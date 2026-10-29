import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Plus, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRecoveryPoint, listRecoveryPoints } from "@/lib/admin.functions";

export function AdminRecoveryPoints() {
  const queryClient = useQueryClient();
  const list = useServerFn(listRecoveryPoints);
  const create = useServerFn(createRecoveryPoint);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branchName, setBranchName] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [sourcePr, setSourcePr] = useState("");

  const points = useQuery({
    queryKey: ["admin-recovery-points"],
    queryFn: () => list(),
    retry: false,
  });
  const save = useMutation({
    mutationFn: () =>
      create({
        data: {
          title,
          description,
          branchName,
          commitSha,
          sourcePr: sourcePr.trim() ? Number(sourcePr) : null,
        },
      }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setBranchName("");
      setCommitSha("");
      setSourcePr("");
      await queryClient.invalidateQueries({ queryKey: ["admin-recovery-points"] });
    },
  });

  return (
    <section className="mt-2 grid gap-4 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4 text-brand-green" />
          Recovery points
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro dos checkpoints de código do GitHub para localizar uma versão estável e orientar
          uma recuperação. Este registro não cria backup do banco de dados nem executa restaurações.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="grid gap-1 text-sm sm:col-span-2">
          Título
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Descrição / observações
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Branch do GitHub
          <Input
            value={branchName}
            onChange={(event) => setBranchName(event.target.value)}
            maxLength={120}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Commit SHA
          <Input
            value={commitSha}
            onChange={(event) => setCommitSha(event.target.value)}
            minLength={7}
            maxLength={40}
            pattern="[0-9a-fA-F]{7,40}"
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          PR de origem (opcional)
          <Input
            value={sourcePr}
            onChange={(event) => setSourcePr(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]+"
          />
        </label>
        <div className="flex items-end sm:col-span-2">
          <Button
            type="submit"
            disabled={save.isPending || !title.trim() || !branchName.trim() || !commitSha.trim()}
          >
            {save.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            Registrar ponto de recuperação
          </Button>
        </div>
        {save.isError && <p className="text-sm text-red-400 sm:col-span-2">{save.error.message}</p>}
        {save.isSuccess && (
          <p className="text-sm text-emerald-400 sm:col-span-2">Ponto de recuperação registrado.</p>
        )}
      </form>

      <div className="grid gap-2">
        <h4 className="text-sm font-semibold">Histórico de pontos de recuperação</h4>
        {points.isPending ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando...
          </div>
        ) : points.isError ? (
          <p className="text-sm text-red-400">{points.error.message}</p>
        ) : points.data?.length ? (
          points.data.map((point) => (
            <article
              key={point.id}
              className="grid gap-1 rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{point.title}</strong>
                <span className="text-xs text-muted-foreground">
                  {new Date(point.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              {point.description && <p className="text-muted-foreground">{point.description}</p>}
              <p className="text-xs text-muted-foreground">
                {point.repository} · {point.environment}
                {point.sourcePr ? ` · PR #${point.sourcePr}` : ""}
              </p>
              <p className="break-all font-mono text-xs">Branch: {point.branchName}</p>
              <p className="break-all font-mono text-xs">Commit: {point.commitSha}</p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum ponto de recuperação registrado.</p>
        )}
      </div>
    </section>
  );
}

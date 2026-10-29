import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAiCreditTopup, deleteAiCreditTopup, getAiCredit } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

const usd = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function day(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Admin "Saldo da API" (user request). Google gives no balance for the Gemini
 * key, so the owner records each top-up and the balance is the top-ups minus
 * the cost measured on every call since the first one (owner only; Admin text
 * is Portuguese, outside the interface language rule).
 */
export function AdminCreditBalance() {
  const load = useServerFn(getAiCredit);
  const add = useServerFn(addAiCreditTopup);
  const remove = useServerFn(deleteAiCreditTopup);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "ai-credit"], queryFn: () => load() });
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "ai-credit"] });

  const save = useMutation({
    mutationFn: () =>
      add({
        data: {
          amountUsd: Number(amount.replace(",", ".")),
          ...(date ? { addedAt: new Date(`${date}T00:00:00-03:00`).toISOString() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setAmount("");
      setDate("");
      setNote("");
      void refresh();
    },
    onError: () => toast.error("Não foi possível salvar a recarga."),
  });
  const drop = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => void refresh(),
    onError: () => toast.error("Não foi possível remover a recarga."),
  });

  if (query.isPending) return null;
  if (query.isError) {
    return (
      <p className="mt-3 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        Não foi possível carregar o saldo da API.
      </p>
    );
  }
  const data = query.data;
  if (!data.ready) {
    return (
      <p className="mt-3 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        Saldo da API: aplique a migração 0067_ai_credit_topups pelo chat do Lovable para registrar
        as recargas.
      </p>
    );
  }
  const amountValue = Number(amount.replace(",", "."));

  return (
    <section
      aria-label="Saldo da API"
      className={cn(
        "mt-3 rounded-xl border p-3 sm:p-4",
        data.low ? "border-warning/40 bg-warning/10" : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
          Saldo da API (Gemini, estimado)
        </h2>
        {data.topups.length ? (
          <p className="text-sm">
            <span className={cn("font-display text-lg font-bold", data.low && "text-warning")}>
              {usd(data.remainingUsd)}
            </span>{" "}
            <span className="text-muted-foreground">
              de {usd(data.loadedUsd)} · gasto {usd(data.spentUsd)} em {data.measuredCalls} chamadas
              desde {data.since ? day(data.since) : "—"}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Registre a recarga feita no Google para acompanhar o saldo.
          </p>
        )}
      </div>
      {data.low && (
        <p className="mt-1 text-xs font-medium text-warning">
          Menos de 20% do crédito restante: considere uma nova recarga.
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        O Google não informa o saldo por API: o valor é o total recarregado menos o custo medido de
        cada chamada (o mesmo de Custo & Desempenho). Confira no faturamento do Google de vez em
        quando.
      </p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (amountValue > 0) save.mutate();
        }}
      >
        <label className="grid gap-1 text-xs">
          Valor (US$)
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="20.00"
            className="h-9 w-28"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Data
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 w-40"
          />
        </label>
        <label className="grid min-w-40 flex-1 gap-1 text-xs">
          Observação
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Recarga no Google AI Studio"
            maxLength={200}
            className="h-9"
          />
        </label>
        <Button type="submit" size="sm" disabled={!(amountValue > 0) || save.isPending}>
          Registrar recarga
        </Button>
      </form>

      {data.topups.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs">
          {data.topups.map((topup) => (
            <li key={topup.id} className="flex items-center gap-2">
              <span className="w-20 text-muted-foreground">{day(topup.added_at)}</span>
              <span className="w-20 font-semibold">{usd(topup.amount_usd)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {topup.note ?? ""}
              </span>
              <button
                type="button"
                onClick={() => drop.mutate(topup.id)}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
                aria-label="Remover recarga"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

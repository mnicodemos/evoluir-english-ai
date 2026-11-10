import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { useUiLang } from "@/lib/uiLang";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAiCreditTopup, deleteAiCreditTopup, getAiCredit } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

const usd = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function day(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { timeZone: "America/Sao_Paulo" });
}

/**
 * Admin "Saldo da API" (user request). Google gives no balance for the Gemini
 * key, so the owner records each top-up and the balance is the top-ups minus
 * the cost measured on every call since the first one (owner only; Admin text
 * follows the selected interface language).
 */
export function AdminCreditBalance() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const locale = pt ? "pt-BR" : "en-US";
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
    onError: () => toast.error(pt ? "Não foi possível salvar a recarga." : "Could not save the top-up."),
  });
  const drop = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => void refresh(),
    onError: () => toast.error(pt ? "Não foi possível remover a recarga." : "Could not remove the top-up."),
  });

  if (query.isPending) return null;
  if (query.isError) {
    return (
      <p className="mt-3 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        {pt ? "Não foi possível carregar o saldo da API." : "Could not load the API balance."}
      </p>
    );
  }
  const data = query.data;
  if (!data.ready) {
    return (
      <p className="mt-3 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        {pt ? "Saldo da API: aplique a migração 0067_ai_credit_topups pelo chat do Lovable para registrar as recargas." : "API balance: apply migration 0067_ai_credit_topups through Lovable chat to track top-ups."}
      </p>
    );
  }
  const amountValue = Number(amount.replace(",", "."));

  return (
    <section
      aria-label={pt ? "Saldo da API" : "API balance"}
      className={cn(
        "mt-3 rounded-xl border p-3 sm:p-4",
        data.low ? "border-warning/40 bg-warning/10" : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4 shrink-0 text-brand-green" aria-hidden="true" />
          {pt ? "Saldo da API (Gemini, estimado)" : "API balance (estimated Gemini balance)"}
        </h2>
        {data.topups.length ? (
          <p className="text-sm">
            <span className={cn("font-display text-lg font-bold", data.low && "text-warning")}>
              {usd(data.remainingUsd)}
            </span>{" "}
            <span className="text-muted-foreground">
              {pt ? `de ${usd(data.loadedUsd)} · gasto ${usd(data.spentUsd)} em ${data.measuredCalls} chamadas desde ${data.since ? day(data.since, locale) : "—"}` : `of ${usd(data.loadedUsd)} · spent ${usd(data.spentUsd)} across ${data.measuredCalls} calls since ${data.since ? day(data.since, locale) : "—"}`}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {pt ? "Registre a recarga feita no Google para acompanhar o saldo." : "Record your Google top-up to track the balance."}
          </p>
        )}
      </div>
      {data.low && (
        <p className="mt-1 text-xs font-medium text-warning">
          {pt ? "Menos de 20% do crédito restante: considere uma nova recarga." : "Less than 20% of credit remains: consider adding funds."}
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {pt ? "O Google não informa o saldo por API: o valor é o total recarregado menos o custo medido de cada chamada (o mesmo de Custo & Desempenho). Confira no faturamento do Google de vez em quando." : "Google does not expose the balance through its API. This estimate subtracts measured call costs from recorded top-ups (the same costs shown in Cost & Performance). Check Google billing periodically."}
      </p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (amountValue > 0) save.mutate();
        }}
      >
        <label className="grid gap-1 text-xs">
          {pt ? "Valor (US$)" : "Amount (USD)"}
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="20.00"
            className="h-9 w-28"
          />
        </label>
        <label className="grid gap-1 text-xs">
          {pt ? "Data" : "Date"}
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 w-40"
          />
        </label>
        <label className="grid min-w-40 flex-1 gap-1 text-xs">
          {pt ? "Observação" : "Note"}
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={pt ? "Recarga no Google AI Studio" : "Google AI Studio top-up"}
            maxLength={200}
            className="h-9"
          />
        </label>
        <Button type="submit" size="sm" disabled={!(amountValue > 0) || save.isPending}>
          {pt ? "Registrar recarga" : "Record top-up"}
        </Button>
      </form>

      {data.topups.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs">
          {data.topups.map((topup) => (
            <li key={topup.id} className="flex items-center gap-2">
              <span className="w-20 text-muted-foreground">{day(topup.added_at, locale)}</span>
              <span className="w-20 font-semibold">{usd(topup.amount_usd)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {topup.note ?? ""}
              </span>
              <button
                type="button"
                onClick={() => drop.mutate(topup.id)}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
                aria-label={pt ? "Remover recarga" : "Remove top-up"}
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

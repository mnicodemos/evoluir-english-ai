import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getAiCostByActivity, getAiCostByStudent } from "@/lib/admin.functions";
import { useUiLang } from "@/lib/uiLang";

type DailyUsdQuote = { rate: number; date: string };

function formatBcbDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return month + "-" + day + "-" + date.getFullYear();
}

async function fetchDailyUsdQuote(): Promise<DailyUsdQuote> {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  const params = new URLSearchParams({
    $top: "1",
    $orderby: "dataHoraCotacao desc",
    $format: "json",
    $select: "cotacaoVenda,dataHoraCotacao",
  });
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    "CotacaoDolarPeriodo(dataInicial='" +
    formatBcbDate(start) +
    "',dataFinalCotacao='" +
    formatBcbDate(today) +
    "')?" +
    params.toString().replace(/\+/g, "%20");
  const response = await fetch(url);
  if (!response.ok) throw new Error("PTAX unavailable");
  const payload = (await response.json()) as {
    value?: { cotacaoVenda?: number; dataHoraCotacao?: string }[];
  };
  const latest = payload.value?.[0];
  const rate = Number(latest?.cotacaoVenda);
  if (!latest || !Number.isFinite(rate) || rate <= 0) throw new Error("PTAX unavailable");
  return { rate, date: latest.dataHoraCotacao ?? "" };
}

const usd = (value: number | null, locale: string) =>
  value === null
    ? "N/D"
    : new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value);
const brl = (value: number | null) =>
  value === null
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function AdminAiCostByActivity() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const [days, setDays] = useState(30);
  const load = useServerFn(getAiCostByActivity);
  const loadStudents = useServerFn(getAiCostByStudent);
  const query = useQuery({
    queryKey: ["admin-ai-cost-by-activity", days],
    queryFn: () => load({ data: { days } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const studentQuery = useQuery({
    queryKey: ["admin-ai-cost-by-student", days],
    queryFn: () => loadStudents({ data: { days } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const quote = useQuery({
    queryKey: ["admin-ai-cost-activity-ptax"],
    queryFn: fetchDailyUsdQuote,
    retry: 1,
    staleTime: 6 * 60 * 60 * 1000,
  });
  const totalUsd = query.data?.totalUsd ?? null;
  const totalBrl = totalUsd !== null && quote.data ? totalUsd * quote.data.rate : null;
  const summaryGroups = (() => {
    const groups = new Map<string, number>();
    const categoryByOperation: Record<string, string> = {
      lesson_generation: "lessons",
      teacher: "teacher",
      talking: "speaking",
      writing_correction: "writing",
      vocabulary_generation: "vocabulary",
      quiz_generation: "quizzes",
      dictionary: "dictionary",
      transcription: "audio",
      tts: "audio",
      chat: "chat",
    };
    for (const activity of query.data?.activities ?? []) {
      const category = categoryByOperation[activity.operation] ?? "other";
      if (activity.costUsd !== null) {
        groups.set(category, (groups.get(category) ?? 0) + activity.costUsd);
      }
    }
    const labels: Record<string, { pt: string; en: string }> = {
      lessons: { pt: "Lessons", en: "Lessons" },
      teacher: { pt: "AI Teacher", en: "AI Teacher" },
      speaking: { pt: "Speaking", en: "Speaking" },
      writing: { pt: "Writing / Correction", en: "Writing / Correction" },
      vocabulary: { pt: "Vocabulary", en: "Vocabulary" },
      quizzes: { pt: "Quizzes", en: "Quizzes" },
      dictionary: { pt: "Dictionary", en: "Dictionary" },
      audio: { pt: "Audio / Transcription", en: "Audio / Transcription" },
      chat: { pt: "Chat", en: "Chat" },
      other: { pt: "Outras atividades", en: "Other activities" },
    };
    return [...groups.entries()]
      .map(([key, costUsd]) => ({
        key,
        label: labels[key]?.[pt ? "pt" : "en"] ?? key,
        costUsd,
        share: totalUsd && totalUsd > 0 ? (costUsd / totalUsd) * 100 : 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);
  })();

  return (
    <section className="pt-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {pt ? "Custo de IA por atividade" : "AI cost by activity"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {pt
              ? "Custos calculados por chamada registrada, sem rateio entre atividades."
              : "Costs calculated from recorded calls, with no allocation across activities."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 7, 30, 90].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={days === value ? "default" : "ghost"}
              onClick={() => setDays(value)}
            >
              {value}d
            </Button>
          ))}
          <Button
            size="icon"
            variant="ghost"
            aria-label={pt ? "Atualizar" : "Refresh"}
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={"size-4 " + (query.isFetching ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {pt ? "Carregando..." : "Loading..."}
        </div>
      ) : query.isError ? (
        <p className="py-8 text-sm text-muted-foreground">
          {pt
            ? "Não foi possível carregar os custos por atividade."
            : "Could not load activity costs."}
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {pt ? "Custo total (USD)" : "Total cost (USD)"}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {usd(totalUsd, pt ? "pt-BR" : "en-US")}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {pt ? "Custo convertido (BRL)" : "Converted cost (BRL)"}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{brl(totalBrl)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {quote.data
                  ? "PTAX " +
                    quote.data.rate.toFixed(4) +
                    " · " +
                    new Date(quote.data.date.replace(" ", "T")).toLocaleDateString(
                      pt ? "pt-BR" : "en-US",
                    )
                  : pt
                    ? "Cotação PTAX indisponível"
                    : "PTAX rate unavailable"}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {pt ? "Chamadas registradas" : "Recorded calls"}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {query.data.calls.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {pt ? "Chamadas com custo medido" : "Calls with measured cost"}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {query.data.measuredCalls.toLocaleString()} / {query.data.calls.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                {pt ? "Onde o custo foi gasto" : "Where the cost went"}
              </h4>
              <span className="text-xs text-muted-foreground">
                {pt ? "Participação no total" : "Share of total"}
              </span>
            </div>
            <div className="space-y-3">
              {summaryGroups.map((group) => (
                <div key={group.key}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{group.label}</span>
                    <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                      {group.share.toFixed(1)}% · {usd(group.costUsd, pt ? "pt-BR" : "en-US")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: group.share + "%" }}
                    />
                  </div>
                </div>
              ))}
              {summaryGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {pt ? "Sem custos medidos para resumir." : "No measured costs to summarize."}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-2 pr-3">{pt ? "Atividade" : "Activity"}</th>
                  <th className="py-2 pr-3 text-right">{pt ? "Chamadas" : "Calls"}</th>
                  <th className="py-2 pr-3 text-right">{pt ? "Custo USD" : "USD cost"}</th>
                  <th className="py-2 pr-3 text-right">{pt ? "Custo BRL" : "BRL cost"}</th>
                  <th className="py-2 pr-3 text-right">{pt ? "Média/chamada" : "Average/call"}</th>
                  <th className="py-2 text-right">{pt ? "% do total" : "% of total"}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.activities.map((row) => (
                  <tr key={row.operation} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{row.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.calls.toLocaleString()}
                      <span className="block text-[11px] text-muted-foreground">
                        {row.measuredCalls}/{row.calls} {pt ? "medidas" : "measured"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {usd(row.costUsd, pt ? "pt-BR" : "en-US")}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {brl(
                        row.costUsd !== null && quote.data ? row.costUsd * quote.data.rate : null,
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {usd(row.averageCostUsd, pt ? "pt-BR" : "en-US")}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.sharePercent === null ? "N/D" : row.sharePercent.toFixed(1) + "%"}
                    </td>
                  </tr>
                ))}
                {query.data.activities.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      {pt ? "Sem chamadas no período." : "No calls in this period."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {pt
              ? "O custo USD é recalculado pelos tokens e pela tabela de preços vigente, usando o custo salvo apenas quando não há preço disponível para o modelo. O BRL é uma conversão informativa pela cotação de venda PTAX mais recente; não representa o valor efetivamente debitado. Chamadas sem tokens/preço ficam fora da soma e são mostradas na cobertura."
              : "USD cost is recalculated from tokens and the current price table, using the stored estimate only when no model price is available. BRL is an informational conversion using the latest PTAX selling rate; it is not the amount actually charged. Calls without tokens/pricing are excluded from the sum and shown in coverage."}
          </p>
          {query.data.truncated && (
            <p className="mt-1 text-xs text-muted-foreground">
              {pt
                ? "Amostra limitada às 10.000 chamadas mais recentes."
                : "Sample limited to the 10,000 most recent calls."}
            </p>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-3">
              <h3 className="font-semibold">
                {pt ? "Custo de IA por aluno" : "AI cost per student"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {pt
                  ? "Custo direto estimado pelas chamadas atribuídas a cada aluno. Não inclui rateio operacional nem representa uma fatura."
                  : "Estimated direct cost from calls attributed to each student. Excludes operational allocation and is not an invoice."}
              </p>
            </div>
            {studentQuery.isPending ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {pt ? "Carregando alunos..." : "Loading students..."}
              </div>
            ) : studentQuery.isError ? (
              <p className="py-4 text-sm text-muted-foreground">
                {pt
                  ? "Não foi possível carregar o custo por aluno."
                  : "Could not load per-student costs."}
              </p>
            ) : (
              <>
                <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {(["free", "premium"] as const).map((plan) => {
                    const rows = studentQuery.data.students.filter(
                      (student) => student.plan === plan,
                    );
                    const measured = rows.filter((student) => student.costUsd !== null);
                    const cost = measured.reduce((sum, student) => sum + (student.costUsd ?? 0), 0);
                    return (
                      <div key={plan} className="rounded-md border border-border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">
                          {plan === "free" ? "Free" : "Premium"} ·{" "}
                          {pt ? "alunos com uso" : "students with usage"}
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{rows.length}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pt ? "Custo medido" : "Measured cost"}:{" "}
                          {usd(measured.length ? cost : null, pt ? "pt-BR" : "en-US")}
                          {quote.data && measured.length > 0
                            ? " · " + brl(cost * quote.data.rate)
                            : ""}
                        </p>
                      </div>
                    );
                  })}
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      {pt ? "Custo direto total" : "Total direct cost"}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {usd(studentQuery.data.totalUsd, pt ? "pt-BR" : "en-US")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {studentQuery.data.measuredCalls}/{studentQuery.data.calls}{" "}
                      {pt ? "chamadas com custo" : "calls with cost"}
                    </p>
                  </div>
                </div>
                <div className="max-h-[55vh] overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border text-xs font-semibold uppercase text-muted-foreground">
                        <th className="py-2 pr-3">{pt ? "Aluno" : "Student"}</th>
                        <th className="py-2 pr-3">{pt ? "Plano" : "Plan"}</th>
                        <th className="py-2 pr-3 text-right">{pt ? "Chamadas" : "Calls"}</th>
                        <th className="py-2 pr-3 text-right">{pt ? "Cobertura" : "Coverage"}</th>
                        <th className="py-2 pr-3 text-right">{pt ? "Custo USD" : "USD cost"}</th>
                        <th className="py-2 pr-3 text-right">{pt ? "Custo BRL" : "BRL cost"}</th>
                        <th className="py-2 text-right">{pt ? "Média/chamada" : "Average/call"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentQuery.data.students.map((student) => (
                        <tr key={student.userId} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{student.name}</div>
                            <div className="text-xs text-muted-foreground">{student.email}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {student.operations
                                .map((op) =>
                                  op.costUsd === null
                                    ? op.label + ": N/D"
                                    : op.label + ": " + usd(op.costUsd, pt ? "pt-BR" : "en-US"),
                                )
                                .join(" · ")}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            {student.plan === "premium" ? "Premium" : "Free"}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{student.calls}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {student.measuredCalls}/{student.calls}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {usd(student.costUsd, pt ? "pt-BR" : "en-US")}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {brl(
                              student.costUsd !== null && quote.data
                                ? student.costUsd * quote.data.rate
                                : null,
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {usd(student.averageCostUsd, pt ? "pt-BR" : "en-US")}
                          </td>
                        </tr>
                      ))}
                      {studentQuery.data.students.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-muted-foreground">
                            {pt
                              ? "Nenhuma chamada de IA no período."
                              : "No AI calls in this period."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {pt
                    ? "A média considera apenas chamadas com custo calculável. N/D indica que o registro não possui tokens/preço suficientes. O plano reflete a situação atual do aluno, não necessariamente a situação na data de cada chamada."
                    : "Averages include only calls with a calculable cost. N/A means the record lacks sufficient token/pricing data. Plan reflects the student's current status, not necessarily their status when each call occurred."}
                </p>
                {studentQuery.data.truncated && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pt
                      ? "Amostra limitada às 10.000 chamadas mais recentes."
                      : "Sample limited to the 10,000 most recent calls."}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

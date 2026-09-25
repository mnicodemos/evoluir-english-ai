import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getAiCostPerformance } from "@/lib/admin.functions";

const ND = "N/D";
const fmtN = (value: number | null) => (value === null ? ND : value.toLocaleString());
const fmtMs = (value: number | null) => (value === null ? ND : `${(value / 1000).toFixed(2)} s`);
const fmtPct = (value: number | null) => (value === null ? ND : `${value.toFixed(1)}%`);
const fmtCost = (value: number | null) =>
  value === null
    ? ND
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function AdminCostPerformance() {
  const [days, setDays] = useState(7);
  const fetchBenchmark = useServerFn(getAiCostPerformance);
  const query = useQuery({
    queryKey: ["admin-cost-performance", days],
    queryFn: () => fetchBenchmark({ data: { days } }),
    retry: false,
    staleTime: Infinity,
  });

  return (
    <section className="pt-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Custo &amp; Performance</h3>
          <p className="text-xs text-muted-foreground">
            Benchmark técnico e econômico somente leitura
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 7, 30].map((value) => (
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
            aria-label="Atualizar benchmark"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {query.isPending ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando
        </div>
      ) : query.isError ? (
        <p className="py-8 text-sm text-muted-foreground">
          Não foi possível carregar o benchmark agora.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            {[
              ["Chamadas analisadas", query.data.calls.toLocaleString()],
              ["Operações", query.data.operations.toLocaleString()],
              ["Créditos Lovable", ND],
              ["Custo Google", fmtCost(query.data.estimatedCost)],
              ["Latência média", fmtMs(query.data.avgMs)],
              ["Taxa de erro", fmtPct(query.data.errorRate)],
              ["Cache HIT", query.data.cacheHits.toLocaleString()],
              ["Cache ativo", query.data.activeCacheEntries.toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["1.000 chamadas", query.data.projectedCost1k],
              ["10.000 chamadas", query.data.projectedCost10k],
              ["100.000 chamadas", query.data.projectedCost100k],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Projeção · baseada no custo registrado
                </p>
                <p className="font-medium">
                  {label}: {fmtCost(value as number | null)}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Observado: chamadas, tokens, latência, erros e HITs cumulativos do cache. Calculado:
            totais e médias. Estimado: custo e projeções somente quando todos os registros possuem
            custo. Provider: derivado do identificador do modelo registrado. First token, first
            chunk, retries, fallback e cache MISS: N/D.
          </p>
          {query.data.truncated && (
            <p className="mt-1 text-xs text-muted-foreground">
              Amostra limitada aos 10.000 registros mais recentes.
            </p>
          )}

          <div className="mt-4 max-h-[48vh] overflow-auto">
            <table className="w-full min-w-[1680px] text-left text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border font-semibold uppercase text-muted-foreground">
                  {[
                    "Operação",
                    "Provider",
                    "Modelo",
                    "Chamadas",
                    "Input",
                    "Output",
                    "Total",
                    "Latência",
                    "First token",
                    "First chunk",
                    "Erros",
                    "Retries",
                    "Fallback",
                    "Cache HIT",
                    "Cache MISS",
                    "Créditos",
                    "Custo",
                    "1k",
                    "10k",
                    "100k",
                  ].map((heading) => (
                    <th key={heading} className="py-2 pr-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.comparisons.map((row) => (
                  <tr
                    key={`${row.operation}-${row.model}`}
                    className="border-b border-border/60 align-top"
                  >
                    <td className="py-2 pr-3 font-medium">{row.label}</td>
                    <td className="pr-3">{row.provider}</td>
                    <td className="pr-3">{row.model}</td>
                    <td className="pr-3">{row.calls}</td>
                    <td className="pr-3">{fmtN(row.inputTokens)}</td>
                    <td className="pr-3">{fmtN(row.outputTokens)}</td>
                    <td className="pr-3">
                      {fmtN(row.totalTokens)}
                      <div className="text-muted-foreground">
                        {row.tokenCoverage}/{row.calls} medidos
                      </div>
                    </td>
                    <td className="pr-3">{fmtMs(row.avgMs)}</td>
                    <td className="pr-3">{ND}</td>
                    <td className="pr-3">{ND}</td>
                    <td className="pr-3">{row.errors}</td>
                    <td className="pr-3">{ND}</td>
                    <td className="pr-3">{ND}</td>
                    <td className="pr-3">
                      {row.cacheHits}
                      <div className="text-muted-foreground">cumulativo</div>
                    </td>
                    <td className="pr-3">{ND}</td>
                    <td className="pr-3">{ND}</td>
                    <td className="pr-3">{fmtCost(row.estimatedCost)}</td>
                    <td className="pr-3">{fmtCost(row.projectedCost1k)}</td>
                    <td className="pr-3">{fmtCost(row.projectedCost10k)}</td>
                    <td className="pr-3">{fmtCost(row.projectedCost100k)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

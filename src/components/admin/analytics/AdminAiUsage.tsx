// "AI Usage & Performance" section of the existing Admin panel. Read-only view of
// ai_usage_events; loads only when the admin opens it or taps Refresh (no polling).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getAiUsageSummary } from "@/lib/admin.functions";

const ND = "N/D";
const fmtMs = (v: number | null | undefined) => (v == null ? ND : `${(v / 1000).toFixed(1)} s`);
const fmtN = (v: number | null) => (v === null ? ND : v.toLocaleString());

export function AdminAiUsage() {
  const [days, setDays] = useState(7);
  const fetchSummary = useServerFn(getAiUsageSummary);
  const q = useQuery({
    queryKey: ["admin-ai-usage", days],
    queryFn: () => fetchSummary({ data: { days } }),
    retry: false,
    staleTime: Infinity,
  });

  return (
    <section className="mt-2 border-t border-border pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">AI Usage & Performance</h3>
        <div className="flex items-center gap-1">
          {[1, 7, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "ghost"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Refresh"
            onClick={() => void q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {q.isPending ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading
        </div>
      ) : q.isError ? (
        <p className="py-4 text-sm text-muted-foreground">Could not load AI usage right now.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            Total AI calls ({q.data.days}d): <strong>{q.data.totalCalls}</strong>
            {q.data.truncated ? " (first 10,000)" : ""} · Measured cost:{" "}
            {q.data.estimatedCost === null
              ? ND
              : `$${q.data.estimatedCost.toFixed(2)} (${q.data.costCoverage}/${q.data.totalCalls} calls with tokens)`}{" "}
            · Cost per operation and time to the first word/sound: Cost &amp; Performance tab
          </p>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border font-semibold uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Operation</th>
                  <th className="pr-2">Calls</th>
                  <th className="pr-2">OK</th>
                  <th className="pr-2" title="Real failures (not blocked, not cancelled)">
                    Errors
                  </th>
                  <th className="pr-2">Timeouts</th>
                  <th className="pr-2">Cancelled</th>
                  <th
                    className="pr-2"
                    title="Refused by a limit before calling the AI; the app waits and retries"
                  >
                    Blocked
                  </th>
                  <th className="pr-2">Avg</th>
                  <th className="pr-2">P95</th>
                  <th className="pr-2">Max</th>
                  <th className="pr-2">Tokens in</th>
                  <th className="pr-2">Tokens out</th>
                  <th className="pr-2">Global limit</th>
                  <th className="pr-2">Streaming</th>
                  <th className="pr-2">Provider / path</th>
                  <th>Top errors</th>
                </tr>
              </thead>
              <tbody>
                {q.data.operations.map((o) => (
                  <tr key={o.operation} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-2 font-medium">
                      {o.label}
                      <div className="text-muted-foreground">{o.models.join(", ")}</div>
                    </td>
                    <td className="pr-2">{o.calls}</td>
                    <td className="pr-2">{o.ok}</td>
                    <td className="pr-2">{o.errors}</td>
                    <td className="pr-2">{o.timeouts}</td>
                    <td className="pr-2">{o.cancelled}</td>
                    <td className="pr-2">{o.blocked}</td>
                    <td className="pr-2">{fmtMs(o.avgMs)}</td>
                    <td className="pr-2">{fmtMs(o.p95Ms)}</td>
                    <td className="pr-2">{fmtMs(o.maxMs)}</td>
                    <td className="pr-2">
                      {fmtN(o.inputTokens)}
                      {o.inputTokens !== null && o.callsWithTokens < o.calls && (
                        <div className="text-muted-foreground">
                          {o.callsWithTokens}/{o.calls} calls
                        </div>
                      )}
                    </td>
                    <td className="pr-2">{fmtN(o.outputTokens)}</td>
                    <td className="pr-2">{o.globalMaxConcurrent ?? "Sem limite"}</td>
                    <td className="pr-2">{o.streaming ?? ND}</td>
                    <td className="pr-2">
                      {o.path ?? ND}
                      <div className="text-muted-foreground">
                        Recorded: {o.providers.join(", ")}
                      </div>
                    </td>
                    <td className="text-muted-foreground">{o.topErrors.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Calls = OK + Errors + Cancelled + Blocked. Errors are real failures; Blocked are
            requests refused by a limit (another one was running) that the app waits on and retries;
            Cancelled includes abandoned. Retries: {ND} (retries inside one call are not recorded
            separately).
          </p>
          <LatencyByDay trend={q.data.latencyTrend} />
        </>
      )}
    </section>
  );
}

/** Below this many calls a day's median is noise, so it is never colored. */
const MIN_TREND_CALLS = 5;

type Trend = Awaited<ReturnType<typeof getAiUsageSummary>>["latencyTrend"];

/** Median answer time per day (successful calls only), to confirm speed changes reach students. */
function LatencyByDay({ trend }: { trend: Trend }) {
  if (!trend.days.length) return null;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold">Answer time by day (median)</h4>
      <p className="mb-2 text-xs text-muted-foreground">
        Successful calls only, São Paulo days. Green = faster than the previous day with enough
        calls, red = slower (changes under 10% stay neutral). Days with fewer than {MIN_TREND_CALLS}{" "}
        calls are greyed out and never colored: too few to compare.
      </p>
      <div className="max-h-[40vh] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b border-border font-semibold uppercase text-muted-foreground">
              <th className="py-2 pr-3">Operation</th>
              {trend.days.map((day) => (
                <th key={day} className="whitespace-nowrap pr-3">
                  {day.slice(5).replace("-", "/")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trend.operations.map((entry) => {
              let previous: number | null = null;
              return (
                <tr key={entry.operation} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{entry.label}</td>
                  {trend.days.map((day) => {
                    const cell = entry.cells[day];
                    const median = cell?.medianMs ?? null;
                    const enough = (cell?.calls ?? 0) >= MIN_TREND_CALLS;
                    const change =
                      enough && median !== null && previous !== null && previous > 0
                        ? (median - previous) / previous
                        : 0;
                    if (enough && median !== null) previous = median;
                    return (
                      <td
                        key={day}
                        className={`whitespace-nowrap pr-3 tabular-nums ${
                          !enough
                            ? "text-muted-foreground"
                            : change <= -0.1
                              ? "text-emerald-400"
                              : change >= 0.1
                                ? "text-red-400"
                                : ""
                        }`}
                      >
                        {cell ? (
                          median === null ? (
                            // Every call of the day was cancelled, blocked or failed.
                            <span
                              className="text-muted-foreground"
                              title="No call finished this day (cancelled, blocked or failed), so there is no answer time"
                            >
                              no OK · {cell.calls}
                            </span>
                          ) : (
                            <>
                              {fmtMs(median)}
                              <span className="text-muted-foreground"> · {cell.calls}</span>
                            </>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

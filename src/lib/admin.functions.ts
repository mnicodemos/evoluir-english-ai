// Admin panel backend. Authorization happens server-side only through the
// existing user_roles/has_role database authority.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { latencyByDay } from "@/lib/aiLatencyTrend";
import { studyToday } from "@/lib/today";

async function hasAdminRole(
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null; error: unknown }>;
  },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  return error === null && data === true;
}

export const isAdminUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    isAdmin: await hasAdminRole(context.supabase, context.userId),
  }));

export const listRegisteredUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error, count } = await supabaseAdmin
      .from("profiles")
      .select("name, email", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    return {
      total: count ?? data.length,
      users: (data ?? []).map((row) => ({ name: row.name, email: row.email ?? "" })),
    };
  });

// Static facts read from the current code (not from the database), so the panel
// can show them next to the measured numbers. "primary" = main path in code.
const OPERATION_FACTS: Record<string, { label: string; streaming: string; path: string }> = {
  talking: {
    label: "AI Talking",
    streaming: "Yes",
    path: "Primary: Gemini (personal key) · opener and streamed reply",
  },
  teacher: { label: "AI Teacher", streaming: "No", path: "Primary: Gemini (personal key)" },
  transcription: {
    label: "Transcription",
    streaming: "Yes",
    path: "Primary: Gemini (personal key) · Fallback: Lovable AI",
  },
  tts: { label: "TTS", streaming: "Yes", path: "Primary: Gemini (personal key)" },
  writing_correction: { label: "Writing / Correction", streaming: "No", path: "Primary: Gemini" },
  dictionary: { label: "Dictionary", streaming: "No", path: "Primary: Gemini" },
  vocabulary_generation: { label: "Vocabulary", streaming: "No", path: "Primary: Gemini" },
  quiz_generation: { label: "Quiz", streaming: "No", path: "Primary: Gemini" },
  lesson_generation: { label: "Lesson Generation", streaming: "No", path: "Primary: Gemini" },
  chat: { label: "Chat", streaming: "No", path: "Primary: Gemini" },
};

function providerOf(model: string) {
  return model.includes("/") ? "Lovable AI" : "Gemini (personal key)";
}

// Transcription records the model that actually answered since 2026-10-06
// (before, a Lovable answer was stored under the reserved Gemini name).
function benchmarkProviderOf(_operation: string, model: string) {
  return providerOf(model);
}

type BenchmarkUsageRow = {
  operation: string;
  model: string;
  success: boolean | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
  error_code?: string | null;
};

type BenchmarkCacheRow = {
  operation: string;
  model: string;
  hit_count: number;
  expires_at: string;
};

function sumOrNull(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => typeof value === "number");
  return measured.length === values.length && measured.length > 0
    ? measured.reduce((sum, value) => sum + value, 0)
    : null;
}

function sumMeasured(values: Array<number | null>): number | null {
  const measured = values.filter((value): value is number => typeof value === "number");
  return measured.length ? measured.reduce((sum, value) => sum + value, 0) : null;
}

function percentile(sorted: number[], value: number): number | null {
  if (sorted.length < 10) return null;
  const index = (sorted.length - 1) * value;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return Math.round(sorted[lower] ?? 0);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return Math.round(lowerValue + (upperValue - lowerValue) * (index - lower));
}

export function aggregateCostPerformance(
  rows: BenchmarkUsageRow[],
  cacheRows: BenchmarkCacheRow[],
) {
  const cacheByGroup = new Map<string, { hits: number; activeEntries: number }>();
  const now = Date.now();
  for (const row of cacheRows) {
    const key = `${row.operation}\u0000${row.model}`;
    const current = cacheByGroup.get(key) ?? { hits: 0, activeEntries: 0 };
    current.hits += row.hit_count;
    if (Date.parse(row.expires_at) > now) current.activeEntries += 1;
    cacheByGroup.set(key, current);
  }

  const groups = new Map<string, BenchmarkUsageRow[]>();
  for (const row of rows) {
    const key = `${row.operation}\u0000${row.model}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const comparisons = [...groups.entries()]
    .map(([key, groupRows]) => {
      const separator = key.indexOf("\u0000");
      const operation = key.slice(0, separator);
      const model = key.slice(separator + 1);
      const durations = groupRows
        .map((row) => row.duration_ms)
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);
      const inputTokens = sumMeasured(groupRows.map((row) => row.input_tokens));
      const outputTokens = sumMeasured(groupRows.map((row) => row.output_tokens));
      const estimatedCost = sumOrNull(groupRows.map((row) => row.estimated_cost));
      const cache = cacheByGroup.get(key) ?? { hits: 0, activeEntries: 0 };
      const costPerCall = estimatedCost === null ? null : estimatedCost / groupRows.length;
      return {
        operation,
        label: OPERATION_FACTS[operation]?.label ?? operation,
        provider: benchmarkProviderOf(operation, model),
        model,
        calls: groupRows.length,
        inputTokens,
        outputTokens,
        totalTokens:
          inputTokens === null || outputTokens === null ? null : inputTokens + outputTokens,
        tokenCoverage: groupRows.filter(
          (row) => row.input_tokens !== null || row.output_tokens !== null,
        ).length,
        avgMs: durations.length
          ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
          : null,
        totalDurationMs: durations.length ? durations.reduce((sum, value) => sum + value, 0) : null,
        medianMs: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
        errors: groupRows.filter((row) => row.success === false).length,
        errorRate: groupRows.length
          ? (groupRows.filter((row) => row.success === false).length / groupRows.length) * 100
          : null,
        timeouts: groupRows.filter((row) => row.error_code === "timeout").length,
        cancellations: groupRows.filter(
          (row) => row.error_code === "cancelled" || row.error_code === "abandoned",
        ).length,
        errorTypes: Object.entries(
          groupRows.reduce<Record<string, number>>((counts, row) => {
            if (row.success === false) {
              const code = row.error_code ?? "unknown";
              counts[code] = (counts[code] ?? 0) + 1;
            }
            return counts;
          }, {}),
        )
          .sort((a, b) => b[1] - a[1])
          .map(([code, count]) => `${code} (${count})`),
        firstTokenMs: null,
        firstChunkMs: null,
        retries: null,
        fallback: null,
        cacheHits: cache.hits,
        activeCacheEntries: cache.activeEntries,
        cacheMisses: operation === "dictionary" ? groupRows.length : null,
        cacheHitRate: null,
        cacheSavings: null,
        lovableCredits: null,
        estimatedCost,
        projectedCost1k: costPerCall === null ? null : costPerCall * 1_000,
        projectedCost10k: costPerCall === null ? null : costPerCall * 10_000,
        projectedCost100k: costPerCall === null ? null : costPerCall * 100_000,
      };
    })
    .sort((a, b) => b.calls - a.calls);

  const measuredDurations = rows
    .map((row) => row.duration_ms)
    .filter((value): value is number => typeof value === "number");
  const estimatedCost = sumOrNull(rows.map((row) => row.estimated_cost));
  const costPerCall =
    estimatedCost === null || rows.length === 0 ? null : estimatedCost / rows.length;
  return {
    calls: rows.length,
    operations: new Set(rows.map((row) => row.operation)).size,
    avgMs: measuredDurations.length
      ? Math.round(
          measuredDurations.reduce((sum, value) => sum + value, 0) / measuredDurations.length,
        )
      : null,
    errorRate: rows.length
      ? (rows.filter((row) => row.success === false).length / rows.length) * 100
      : null,
    cacheHits: cacheRows.reduce((sum, row) => sum + row.hit_count, 0),
    activeCacheEntries: cacheRows.filter((row) => Date.parse(row.expires_at) > now).length,
    lovableCredits: null,
    estimatedCost,
    projectedCost1k: costPerCall === null ? null : costPerCall * 1_000,
    projectedCost10k: costPerCall === null ? null : costPerCall * 10_000,
    projectedCost100k: costPerCall === null ? null : costPerCall * 100_000,
    comparisons,
  };
}

/** Read-only aggregation of the existing ai_usage_events table. Runs only on admin request. */
export const getAiUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ days: z.number().int().min(1).max(90) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("ai_usage_events")
      .select(
        "operation, model, success, status, duration_ms, input_tokens, output_tokens, error_code, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw error;
    const { data: limitRows } = await supabaseAdmin
      .from("ai_limits")
      .select("operation, global_max_concurrent");
    const globalLimit = new Map(
      (limitRows ?? []).map((l) => [l.operation, l.global_max_concurrent] as const),
    );

    type Agg = {
      operation: string;
      calls: number;
      ok: number;
      errors: number;
      timeouts: number;
      cancelled: number;
      blocked: number;
      durations: number[];
      withTokens: number;
      inputTokens: number;
      outputTokens: number;
      models: Set<string>;
      errorCodes: Record<string, number>;
      /** Latest occurrence of each error code (ISO), to tell old from current problems. */
      errorLastSeen: Record<string, string>;
    };
    const map = new Map<string, Agg>();
    for (const r of rows ?? []) {
      let a = map.get(r.operation);
      if (!a) {
        a = {
          operation: r.operation,
          calls: 0,
          ok: 0,
          errors: 0,
          timeouts: 0,
          cancelled: 0,
          blocked: 0,
          durations: [],
          withTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          models: new Set(),
          errorCodes: {},
          errorLastSeen: {},
        };
        map.set(r.operation, a);
      }
      a.calls++;
      a.models.add(r.model);
      if (r.success) a.ok++;
      else if (r.success === false) {
        const code = r.error_code ?? "unknown";
        a.errorCodes[code] = (a.errorCodes[code] ?? 0) + 1;
        if (!a.errorLastSeen[code] || r.created_at > a.errorLastSeen[code]!)
          a.errorLastSeen[code] = r.created_at;
        if (code === "timeout") a.timeouts++;
        // Three separate outcomes, so Calls = OK + Errors + Cancelled + Blocked:
        // blocked = refused before calling the AI (the app waits and retries),
        // cancelled = the student left or the request was cut, errors = real failures.
        if (code === "cancelled" || code === "abandoned") a.cancelled++;
        else if (code === "concurrent_limit" || code === "rate_limit" || code.endsWith("_limit"))
          a.blocked++;
        else a.errors++;
      }
      if (typeof r.duration_ms === "number") a.durations.push(r.duration_ms);
      if (typeof r.input_tokens === "number" || typeof r.output_tokens === "number") {
        a.withTokens++;
        a.inputTokens += r.input_tokens ?? 0;
        a.outputTokens += r.output_tokens ?? 0;
      }
    }

    const operations = [...map.values()]
      .map((a) => {
        const d = [...a.durations].sort((x, y) => x - y);
        const facts = OPERATION_FACTS[a.operation];
        const models = [...a.models];
        return {
          operation: a.operation,
          label: facts?.label ?? a.operation,
          calls: a.calls,
          ok: a.ok,
          errors: a.errors,
          timeouts: a.timeouts,
          cancelled: a.cancelled,
          blocked: a.blocked,
          topErrors: Object.entries(a.errorCodes)
            .sort((x, y) => y[1] - x[1])
            .slice(0, 3)
            .map(([code, n]) => {
              const last = a.errorLastSeen[code];
              return last
                ? `${code} (${n}, last ${studyToday(new Date(last)).slice(5)})`
                : `${code} (${n})`;
            }),
          avgMs: d.length ? Math.round(d.reduce((s, v) => s + v, 0) / d.length) : null,
          p95Ms: d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.95))] : null,
          maxMs: d.length ? d[d.length - 1] : null,
          // Tokens only count calls that actually reported them; null = not measured.
          callsWithTokens: a.withTokens,
          inputTokens: a.withTokens ? a.inputTokens : null,
          outputTokens: a.withTokens ? a.outputTokens : null,
          models,
          providers: [...new Set(models.map(providerOf))],
          globalMaxConcurrent: globalLimit.get(a.operation) ?? null,
          streaming: facts?.streaming ?? null,
          path: facts?.path ?? null,
        };
      })
      .sort((x, y) => y.calls - x.calls);

    const trend = latencyByDay(rows ?? []);
    return {
      days: data.days,
      totalCalls: (rows ?? []).length,
      truncated: (rows ?? []).length >= 10000,
      operations,
      latencyTrend: {
        days: trend.days,
        operations: trend.operations.map((entry) => ({
          ...entry,
          label: OPERATION_FACTS[entry.operation]?.label ?? entry.operation,
        })),
      },
    };
  });

/** Economic and technical benchmark. Read-only and loaded only when its admin tab is opened. */
export const getAiCostPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ days: z.number().int().min(1).max(90) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const [{ data: rows, error }, { data: cacheRows, error: cacheError }] = await Promise.all([
      supabaseAdmin
        .from("ai_usage_events")
        .select(
          "operation, model, success, duration_ms, input_tokens, output_tokens, estimated_cost, error_code",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000),
      supabaseAdmin
        .from("ai_response_cache")
        .select("operation, model, hit_count, expires_at")
        .limit(10000),
    ]);
    if (error) throw error;
    if (cacheError) throw cacheError;
    return {
      days: data.days,
      truncated: (rows ?? []).length >= 10000,
      ...aggregateCostPerformance(rows ?? [], cacheRows ?? []),
    };
  });

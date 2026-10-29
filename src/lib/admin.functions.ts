// Admin panel backend. Authorization happens server-side only through the
// existing user_roles/has_role database authority.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { latencyByDay } from "@/lib/aiLatencyTrend";
import { estimateAiCost } from "@/lib/aiPricing";
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

/** Failure alerts (scheduled pushes and AI calls) for the Admin "Alerts" box. */
export const getOpsAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOpsAlerts } = await import("@/lib/opsAlerts.server");
    return loadOpsAlerts(supabaseAdmin, new Date(), { includeProduct: true });
  });

export const listRegisteredUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error, count } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, created_at, plan, plan_expires_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // Premium = a valid entitlement (the commercial authority), else a profile
    // plan that has not ended; the launch campaign's places are marked.
    const ids = (data ?? []).map((row) => row.id);
    const now = new Date();
    const [{ data: entitlements }, { data: grants }] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("entitlements")
            .select("user_id, expires_at, revoked_at")
            .in("user_id", ids)
            .eq("plan", "premium")
        : Promise.resolve({
            data: [] as { user_id: string; expires_at: string | null; revoked_at: string | null }[],
          }),
      ids.length
        ? supabaseAdmin
            .from("premium_campaign_grants")
            .select("user_id, expires_at")
            .in("user_id", ids)
        : Promise.resolve({ data: [] }),
    ]);
    const premiumUntil = new Map<string, string | null>();
    for (const row of entitlements ?? []) {
      if (row.revoked_at) continue;
      if (row.expires_at && new Date(row.expires_at) <= now) continue;
      const current = premiumUntil.get(row.user_id);
      if (current === null) continue;
      premiumUntil.set(
        row.user_id,
        !row.expires_at ? null : current && current > row.expires_at ? current : row.expires_at,
      );
    }
    const campaign = new Set(((grants ?? []) as { user_id: string }[]).map((row) => row.user_id));

    return {
      total: count ?? data.length,
      users: (data ?? []).map((row) => {
        const profilePremium =
          row.plan === "premium" && (!row.plan_expires_at || new Date(row.plan_expires_at) > now);
        const premium = premiumUntil.has(row.id) || profilePremium;
        return {
          name: row.name,
          email: row.email ?? "",
          createdAt: row.created_at,
          plan: premium ? ("premium" as const) : ("free" as const),
          premiumUntil: premium
            ? (premiumUntil.get(row.id) ?? (profilePremium ? row.plan_expires_at : null))
            : null,
          campaign: campaign.has(row.id),
        };
      }),
    };
  });

// Static facts read from the current code (not from the database), so the panel
// can show them next to the measured numbers. "primary" = main path in code.
const OPERATION_FACTS: Record<string, { label: string; streaming: string; path: string }> = {
  talking: {
    label: "AI Speaking",
    streaming: "Yes",
    path: "Primary: Gemini (personal key) · opener and streamed reply",
  },
  teacher: { label: "AI Teacher", streaming: "No", path: "Primary: Gemini (personal key)" },
  transcription: {
    label: "Transcription",
    streaming: "Yes",
    path: "Primary: Gemini (personal key)",
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

// Older transcription rows stored a Lovable answer under the reserved Gemini
// name, so a plain model name cannot name the provider; a Lovable fallback is
// recorded as its own model from 2026-10-06 on.
function benchmarkProviderOf(operation: string, model: string) {
  if (operation === "transcription" && !model.includes("/")) {
    return "N/D — provider não registrado";
  }
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
  /** Time to the first word / sound (streaming calls; migration 0045). */
  first_chunk_ms?: number | null;
};

type BenchmarkCacheRow = {
  operation: string;
  model: string;
  hit_count: number;
  expires_at: string;
};

/**
 * Cost of one call, computed now from its tokens with the current price table
 * (a price added or corrected later, e.g. gemini-3.6-flash on 2026-10-09 from
 * the owner's Google billing, re-prices earlier calls too); the stored estimate
 * is only used when the model has no price in the table.
 */
function rowCost(row: BenchmarkUsageRow): number | null {
  return estimateAiCost(row.model, row.input_tokens, row.output_tokens) ?? row.estimated_cost;
}

function isCancellation(row: BenchmarkUsageRow): boolean {
  return row.error_code === "cancelled" || row.error_code === "abandoned";
}

/** Same rule as the AI Usage tab: limits and cancellations are not failures. */
function isRealError(row: BenchmarkUsageRow): boolean {
  if (row.success !== false || isCancellation(row)) return false;
  const code = row.error_code ?? "";
  return !(code === "concurrent_limit" || code === "rate_limit" || code.endsWith("_limit"));
}

/** Measured cost, how many calls it covers, and the average per measured call. */
function costSummary(rows: BenchmarkUsageRow[]) {
  const costs = rows.map(rowCost).filter((cost): cost is number => cost !== null);
  const estimatedCost = costs.length ? costs.reduce((sum, cost) => sum + cost, 0) : null;
  const costPerCall = estimatedCost === null ? null : estimatedCost / costs.length;
  return {
    estimatedCost,
    costCoverage: costs.length,
    projectedCost1k: costPerCall === null ? null : costPerCall * 1_000,
    projectedCost10k: costPerCall === null ? null : costPerCall * 10_000,
    projectedCost100k: costPerCall === null ? null : costPerCall * 100_000,
  };
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
    // AI Speaking mixes the opener (one plain call) and the streamed replies;
    // replies carry a first-word time, so they get their own line.
    const phase = row.operation === "talking" && row.first_chunk_ms != null ? "reply" : "";
    const key = `${row.operation}\u0000${row.model}\u0000${phase}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const comparisons = [...groups.entries()]
    .map(([key, groupRows]) => {
      const [operation = "", model = "", phase = ""] = key.split("\u0000");
      const firstChunks = groupRows
        .map((row) => row.first_chunk_ms)
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);
      const durations = groupRows
        .map((row) => row.duration_ms)
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);
      const inputTokens = sumMeasured(groupRows.map((row) => row.input_tokens));
      const outputTokens = sumMeasured(groupRows.map((row) => row.output_tokens));
      const cost = costSummary(groupRows);
      const cache = cacheByGroup.get(`${operation}\u0000${model}`) ?? {
        hits: 0,
        activeEntries: 0,
      };
      const realErrors = groupRows.filter(isRealError).length;
      return {
        operation,
        // The Lovable AI rows are the fallback path, so they read as such
        // instead of a second, unexplained line for the same operation.
        label: `${OPERATION_FACTS[operation]?.label ?? operation}${phase ? " · reply (streaming)" : ""}${
          model.includes("/") ? " · reserva (Lovable)" : ""
        }`,
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
        errors: realErrors,
        errorRate: groupRows.length ? (realErrors / groupRows.length) * 100 : null,
        blocked: groupRows.filter(
          (row) => row.success === false && !isRealError(row) && !isCancellation(row),
        ).length,
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
        // Median time to the first word / sound, and how many calls measured it.
        firstChunkMs: firstChunks.length
          ? Math.round(firstChunks[Math.floor((firstChunks.length - 1) / 2)]!)
          : null,
        firstChunkCount: firstChunks.length,
        retries: null,
        fallback: null,
        cacheHits: cache.hits,
        activeCacheEntries: cache.activeEntries,
        cacheMisses: operation === "dictionary" ? groupRows.length : null,
        cacheHitRate: null,
        cacheSavings: null,
        lovableCredits: null,
        ...cost,
      };
    })
    .sort((a, b) => b.calls - a.calls);

  const measuredDurations = rows
    .map((row) => row.duration_ms)
    .filter((value): value is number => typeof value === "number");
  const cost = costSummary(rows);
  return {
    calls: rows.length,
    operations: new Set(rows.map((row) => row.operation)).size,
    avgMs: measuredDurations.length
      ? Math.round(
          measuredDurations.reduce((sum, value) => sum + value, 0) / measuredDurations.length,
        )
      : null,
    errorRate: rows.length ? (rows.filter(isRealError).length / rows.length) * 100 : null,
    cacheHits: cacheRows.reduce((sum, row) => sum + row.hit_count, 0),
    // Hits of operations with no call in the period (a cached answer makes no
    // call), so the card and the table add up (user request).
    cacheHitsOutsideTable:
      cacheRows.reduce((sum, row) => sum + row.hit_count, 0) -
      comparisons.reduce((sum, row) => sum + row.cacheHits, 0),
    activeCacheEntries: cacheRows.filter((row) => Date.parse(row.expires_at) > now).length,
    lovableCredits: null,
    ...cost,
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
        "operation, model, success, status, duration_ms, input_tokens, output_tokens, estimated_cost, error_code, created_at",
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
    // Same measured cost as the Cost & Performance tab (user request: the two
    // tabs must agree), instead of "not determinable".
    const cost = costSummary((rows ?? []) as BenchmarkUsageRow[]);
    return {
      days: data.days,
      totalCalls: (rows ?? []).length,
      estimatedCost: cost.estimatedCost,
      costCoverage: cost.costCoverage,
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
    const usageColumns =
      "operation, model, success, duration_ms, input_tokens, output_tokens, estimated_cost, error_code";
    const readUsage = (columns: string) =>
      supabaseAdmin
        .from("ai_usage_events")
        .select(columns)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);
    const [withFirstChunk, { data: cacheRows, error: cacheError }] = await Promise.all([
      readUsage(`${usageColumns}, first_chunk_ms`),
      supabaseAdmin
        .from("ai_response_cache")
        .select("operation, model, hit_count, expires_at")
        .limit(10000),
    ]);
    // first_chunk_ms arrives with migration 0045; until it is applied, read without it.
    const usage = withFirstChunk.error ? await readUsage(usageColumns) : withFirstChunk;
    if (usage.error) throw usage.error;
    const rows = (usage.data ?? []) as unknown as BenchmarkUsageRow[];
    if (cacheError) throw cacheError;
    return {
      days: data.days,
      truncated: (rows ?? []).length >= 10000,
      ...aggregateCostPerformance(rows ?? [], cacheRows ?? []),
    };
  });

/**
 * Admin-only experiment: writes the same path lesson twice, with the current
 * Gemini settings and with the thinking step off, and reports time and how the
 * content validates. Nothing is saved and no student sees it; it exists to
 * judge quality before turning the fast mode on for lessons.
 */
export const compareLessonGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ key: z.string().min(3).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { findCurriculumLesson } = await import("@/lib/curriculum");
    const plan = findCurriculumLesson(data.key);
    if (!plan) throw new Error("Unknown lesson key.");
    const { lessonGenerationRequest, checkLessonContent, jsonValue } =
      await import("@/lib/curriculumContent.server");
    const { callGemini } = await import("@/lib/gemini.server");
    const { messages } = lessonGenerationRequest(plan);

    const run = async (fast: boolean) => {
      const started = Date.now();
      const measured: { outputTokens: number | null } = { outputTokens: null };
      try {
        const raw = await callGemini(
          messages,
          true,
          (usage) => {
            measured.outputTokens = usage.outputTokens ?? null;
          },
          AbortSignal.timeout(90_000),
          fast ? { fast: true } : {},
        );
        const ms = Date.now() - started;
        if (!raw)
          return {
            ms,
            outputTokens: measured.outputTokens,
            error: "Gemini connection missing",
            check: null,
            content: null,
          };
        return {
          ms,
          outputTokens: measured.outputTokens,
          error: null,
          check: checkLessonContent(raw, plan),
          // Pretty JSON for side-by-side reading in the admin panel.
          content: JSON.stringify(jsonValue(raw), null, 2).slice(0, 60_000),
        };
      } catch (error) {
        return {
          ms: Date.now() - started,
          outputTokens: measured.outputTokens,
          error: error instanceof Error ? error.message : "AI call failed",
          check: null,
          content: null,
        };
      }
    };

    // Both at once, so the comparison takes as long as the slower one.
    const [normal, fast] = await Promise.all([run(false), run(true)]);
    return { key: plan.key, title: plan.title, level: plan.level, normal, fast };
  });

/**
 * Admin-only push check: how many devices are registered (the admin's own and
 * everyone's), and a test notification sent to the admin's own devices with
 * each device's result, to tell a device that never registered from a send
 * that fails or a daily job that does not run.
 */
export const pushDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ send: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fcmCredentials, sendFcm } = await import("@/lib/fcm.server");
    const [{ data: mine }, { count: allDevices }, { data: everyone }] = await Promise.all([
      supabaseAdmin
        .from("push_tokens")
        .select("token, last_seen_at, created_at")
        .eq("user_id", context.userId)
        .order("last_seen_at", { ascending: false }),
      supabaseAdmin.from("push_tokens").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("push_tokens").select("user_id"),
    ]);
    const configured = !!fcmCredentials();
    const devices = (mine ?? []).map((row) => ({
      token: `…${row.token.slice(-8)}`,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      result: null as null | { ok: boolean; status?: number; detail?: string; stale?: boolean },
    }));
    const credentials = fcmCredentials();
    if (data.send && credentials) {
      await Promise.all(
        (mine ?? []).map(async (row, index) => {
          const result = await sendFcm(
            credentials,
            row.token,
            {
              title: "Teste de notificação ✅",
              body: "Se você está vendo isto, as notificações chegam neste aparelho.",
              path: "/dashboard",
            },
            "admin push test",
          );
          devices[index]!.result = result.ok
            ? { ok: true }
            : { ok: false, status: result.status, detail: result.detail, stale: result.stale };
        }),
      );
    }
    return {
      configured,
      myDevices: devices,
      allDevices: allDevices ?? 0,
      usersWithPush: new Set((everyone ?? []).map((row) => row.user_id)).size,
    };
  });

/**
 * Retention: how many students come back the day and the week after signing
 * up. Active days come from what students did (activities, finished lessons,
 * answered AI calls), in São Paulo dates. Admins are left out.
 */
export const getRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadRetention } = await import("@/lib/productMetrics.server");
    return loadRetention(supabaseAdmin);
  });

/**
 * How long students wait for EVO in AI Speaking (last 7 days), measured in the
 * browser from the end of each answer. Null until migration 0050 is applied.
 */
export const getSpeakingWait = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSpeakingWait } = await import("@/lib/productMetrics.server");
    return loadSpeakingWait(supabaseAdmin);
  });

/** What students want to improve besides English, from the goals they created. */
export const getGoalsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadGoalsReport } = await import("@/lib/productMetrics.server");
    return loadGoalsReport(supabaseAdmin);
  });

/** Do corrections stick? My mistakes reviewed and answered right, by source. */
export const getMistakeReviewReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadMistakeReviewReport } = await import("@/lib/productMetrics.server");
    return loadMistakeReviewReport(supabaseAdmin);
  });

/** Public home funnel: visits, "Começar" clicks and signups (7 and 30 days). */
export const getLandingFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadLandingFunnel } = await import("@/lib/productMetrics.server");
    return loadLandingFunnel(supabaseAdmin);
  });

/**
 * API credit balance (user request): the top-ups the owner recorded and the
 * cost measured on every AI call since the first one (rowCost, the same as
 * Cost & Performance). Missing table (migration 0067 not applied yet) reads
 * as "not set up" instead of failing the tab.
 */
export const getAiCredit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { creditBalance } = await import("@/lib/aiCredit");
    const { data: topups, error } = await supabaseAdmin
      .from("ai_credit_topups")
      .select("id, added_at, amount_usd, note")
      .order("added_at", { ascending: false });
    if (error) return { ready: false as const };
    const list = (topups ?? []).map((row) => ({ ...row, amount_usd: Number(row.amount_usd) }));
    let spent = 0;
    let measuredCalls = 0;
    const since = list.length ? list[list.length - 1]!.added_at : null;
    if (since) {
      // Read in pages: every call since the first top-up counts.
      const PAGE = 1000;
      for (let from = 0; from < 500_000; from += PAGE) {
        const { data: rows, error: usageError } = await supabaseAdmin
          .from("ai_usage_events")
          .select("model, input_tokens, output_tokens, estimated_cost")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE - 1);
        if (usageError) break;
        for (const row of rows ?? []) {
          const cost = rowCost(row as BenchmarkUsageRow);
          if (cost !== null) {
            spent += cost;
            measuredCalls += 1;
          }
        }
        if (!rows || rows.length < PAGE) break;
      }
    }
    return { ready: true as const, topups: list, measuredCalls, ...creditBalance(list, spent) };
  });

export const addAiCreditTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        amountUsd: z.number().positive().max(100_000),
        addedAt: z.string().datetime().optional(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_credit_topups").insert({
      amount_usd: data.amountUsd,
      ...(data.addedAt ? { added_at: data.addedAt } : {}),
      note: data.note || null,
      created_by: context.userId,
    });
    if (error) throw new Error("The top-up could not be saved");
    return { ok: true };
  });

export const deleteAiCreditTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_credit_topups").delete().eq("id", data.id);
    if (error) throw new Error("The top-up could not be removed");
    return { ok: true };
  });

// ------------------------------------------------------------- Lesson videos
// Admin → Vídeos (audit, 2026-10-25): every curriculum lesson of a level with
// the video the owner approved (lesson_videos, migration 0081) and the videos
// students got. Approving one stores it and puts it in every student's copy.

type LessonVideosTable = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{
        data:
          | {
              curriculum_key: string;
              video_url: string;
              video_seconds: number | null;
              approved_by: string | null;
            }[]
          | null;
        error: { message: string } | null;
      }>;
    };
    upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    update: (row: Record<string, unknown>) => {
      in: (
        column: string,
        values: string[],
      ) => {
        is: (column: string, value: null) => Promise<{ error: { message: string } | null }>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

/**
 * "Refazer escolhas do app" (owner review of B1, 2026-10-26: the old rule let
 * off-topic videos of trusted channels in): the level's videos the app chose
 * and the owner has not approved are taken off, from lesson_videos and from
 * the lessons showing them, so the next search picks again under the current
 * rules. Videos the owner approved or pasted are never touched.
 */
async function clearAutoLessonVideos(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  rows: { curriculum_key: string; video_url: string; approved_by: string | null }[],
) {
  for (const row of rows.filter((item) => item.approved_by === null)) {
    await (
      supabaseAdmin as unknown as {
        from: (table: string) => {
          delete: () => {
            eq: (
              column: string,
              value: string,
            ) => {
              is: (column: string, value: null) => Promise<{ error: { message: string } | null }>;
            };
          };
        };
      }
    )
      .from("lesson_videos")
      .delete()
      .eq("curriculum_key", row.curriculum_key)
      .is("approved_by", null);
    await supabaseAdmin
      .from("lessons")
      .update({ video_url: null, video_duration_seconds: 0 })
      .eq("curriculum_key", row.curriculum_key)
      .eq("video_url", row.video_url);
  }
}

const lessonVideoLevel = z.enum(["a1", "a2", "b1", "b2", "c1", "c2", "business"]);

/**
 * The lessons of one Admin → Vídeos tab: a CEFR level, or the Business
 * English track (owner request, 2026-10-26), whose keys ("biz-u1-l1") are the
 * same at every level, so one video serves B1 to C2.
 */
async function videoTabLessons(level: z.infer<typeof lessonVideoLevel>) {
  if (level === "business") {
    const { getBusinessCourse } = await import("@/lib/businessCourse");
    return getBusinessCourse("b1");
  }
  const { getCurriculum } = await import("@/lib/curriculum");
  return getCurriculum(level);
}

export const getLessonVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ level: lessonVideoLevel }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lessonVideoReport } = await import("@/lib/lessonVideoReport");
    const curriculum = await videoTabLessons(data.level);
    const keys = curriculum.map((plan) => plan.key);

    // Every student's copy of these lessons, page by page (1,000 rows a request).
    const lessons: {
      curriculum_key: string | null;
      video_url: string | null;
      video_duration_seconds: number | null;
    }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabaseAdmin
        .from("lessons")
        .select("curriculum_key, video_url, video_duration_seconds")
        .in("curriculum_key", keys)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error("The lessons could not be read");
      lessons.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }

    // Before migration 0081 the table does not exist: no approvals yet.
    const { data: approved, error: approvedError } = await (
      supabaseAdmin as unknown as LessonVideosTable
    )
      .from("lesson_videos")
      .select("curriculum_key, video_url, video_seconds, approved_by")
      .in("curriculum_key", keys);
    return {
      migrationApplied: !approvedError,
      lessons: lessonVideoReport(curriculum, approved ?? [], lessons),
    };
  });

export const setLessonVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        key: z.string().min(3).max(40),
        url: z.string().trim().min(10).max(300),
        seconds: z.number().int().min(1).max(7200).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { findCurriculumLesson } = await import("@/lib/curriculum");
    const { findBusinessLesson } = await import("@/lib/businessCourse");
    const { canonicalVimeoUrl } = await import("@/lib/lessonVideoReport");
    if (!findCurriculumLesson(data.key) && !findBusinessLesson(data.key, "b1")) {
      throw new Error("Unknown lesson");
    }
    const url = canonicalVimeoUrl(data.url);
    if (!url) throw new Error("Cole um link válido do Vimeo.");
    const seconds = data.seconds;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as LessonVideosTable)
      .from("lesson_videos")
      .upsert({
        curriculum_key: data.key,
        video_url: url,
        video_seconds: seconds,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      });
    if (error) throw new Error("The video could not be saved");
    // Every student's copy of the lesson shows it from now on.
    const { error: lessonsError } = await supabaseAdmin
      .from("lessons")
      .update({ video_url: url, video_duration_seconds: seconds ?? 0 })
      .eq("curriculum_key", data.key);
    if (lessonsError) throw new Error("The lessons could not be updated");
    return { ok: true, url, seconds };
  });

/** Lessons searched per call, so one request stays short; the page calls again. */
const FILL_BATCH = 6;

/**
 * Admin → Vídeos "Buscar vídeos do nível" (owner request, 2026-10-26): fixes a
 * video, found through the YouTube Data API, for the level's lessons that have
 * none yet, before any student opens them. Saved like an approval but with no
 * approver (approved_by null: "escolhido pelo app"), so the owner can review
 * and swap it. Review units are skipped (no topic to search). `skip` holds the
 * keys already tried in this run with nothing found.
 */
export const fillLessonVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        level: lessonVideoLevel,
        skip: z.array(z.string().max(40)).max(60),
        redo: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const key = process.env["YOUTUBE_API_KEY"];
    if (!key) throw new Error("Falta o segredo YOUTUBE_API_KEY no Lovable.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { prefillLessonVideo, YoutubeApiError } = await import("@/lib/lessonVideo.server");
    const plans = (await videoTabLessons(data.level)).filter(
      (plan) => plan.reviewUnits.length === 0 && !data.skip.includes(plan.key),
    );
    const { data: fixed, error } = await (supabaseAdmin as unknown as LessonVideosTable)
      .from("lesson_videos")
      .select("curriculum_key, video_url, video_seconds, approved_by")
      .in(
        "curriculum_key",
        plans.map((plan) => plan.key),
      );
    if (error) throw new Error("A migração 0081_lesson_videos ainda não foi aplicada.");
    let fixedRows = fixed ?? [];
    if (data.redo) {
      await clearAutoLessonVideos(supabaseAdmin, fixedRows);
      fixedRows = fixedRows.filter((row) => row.approved_by !== null);
    }
    // Fixed videos without a length (pasted without mm:ss) get it from YouTube.
    const noLength = fixedRows.filter((row) => !row.video_seconds);
    let lengthsFilled = 0;
    if (noLength.length > 0) {
      const { fetchVideoDurations } = await import("@/lib/lessonVideo.server");
      const idOf = (url: string) => url.slice(url.indexOf("v=") + 2);
      const durations = await fetchVideoDurations(
        noLength.map((row) => idOf(row.video_url)),
        key,
      ).catch((err: unknown) => {
        console.error("YouTube video durations failed", err);
        return new Map<string, number>();
      });
      for (const row of noLength) {
        const seconds = durations.get(idOf(row.video_url));
        if (!seconds) continue;
        await (supabaseAdmin as unknown as LessonVideosTable)
          .from("lesson_videos")
          .upsert({ ...row, video_seconds: seconds });
        await supabaseAdmin
          .from("lessons")
          .update({ video_duration_seconds: seconds })
          .eq("curriculum_key", row.curriculum_key)
          .eq("video_url", row.video_url);
        lengthsFilled += 1;
      }
    }
    const done = new Set(fixedRows.map((row) => row.curriculum_key));
    const todo = plans.filter((plan) => !done.has(plan.key));

    const filled: string[] = [];
    const notFound: string[] = [];
    for (const plan of todo.slice(0, FILL_BATCH)) {
      let video;
      try {
        video = await prefillLessonVideo(plan, key);
      } catch (err) {
        if (err instanceof YoutubeApiError) {
          console.error(err.message);
          const quota = err.status === 403 || err.status === 429;
          throw new Error(
            quota
              ? "O YouTube recusou a busca: cota do dia esgotada ou chave inválida. Tente amanhã ou confira a chave."
              : "O YouTube recusou a busca. Tente de novo mais tarde.",
          );
        }
        throw err;
      }
      if (!video) {
        notFound.push(plan.key);
        continue;
      }
      const { error: saveError } = await (supabaseAdmin as unknown as LessonVideosTable)
        .from("lesson_videos")
        .upsert({
          curriculum_key: plan.key,
          video_url: video.url,
          video_seconds: video.seconds,
          approved_by: null,
          approved_at: new Date().toISOString(),
        });
      if (saveError) throw new Error("O vídeo não pôde ser salvo.");
      await supabaseAdmin
        .from("lessons")
        .update({ video_url: video.url, video_duration_seconds: video.seconds })
        .eq("curriculum_key", plan.key);
      filled.push(plan.key);
    }
    return {
      filled,
      notFound,
      lengthsFilled,
      remaining: Math.max(0, todo.length - FILL_BATCH),
    };
  });

/**
 * Admin → Vídeos "Aprovar marcados" (owner request, 2026-10-26: approve the
 * app's good choices in one go): the marked lessons' videos chosen by the app
 * become the owner's approval. Only rows still without an approver change, so
 * a video the owner chose is never touched; the lessons already show it.
 */
export const approveLessonVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ keys: z.array(z.string().min(3).max(40)).min(1).max(60) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as LessonVideosTable)
      .from("lesson_videos")
      .update({ approved_by: context.userId, approved_at: new Date().toISOString() })
      .in("curriculum_key", data.keys)
      .is("approved_by", null);
    if (error) throw new Error("Os vídeos não puderam ser aprovados.");
    return { ok: true };
  });

export const clearLessonVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ key: z.string().min(3).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as LessonVideosTable)
      .from("lesson_videos")
      .delete()
      .eq("curriculum_key", data.key);
    if (error) throw new Error("The video could not be removed");
    const { error: lessonsError } = await supabaseAdmin
      .from("lessons")
      .update({ video_url: null, video_duration_seconds: 0 })
      .eq("curriculum_key", data.key);
    if (lessonsError) throw new Error("The lesson video could not be removed");
    return { ok: true };
  });

// Summary videos follow the same working lesson-video path: public.lessons.video_url.
// The Summary flow does not read or write the legacy lesson_videos table.
export const getSummaryVideoLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ level: lessonVideoLevel }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const curriculum = await videoTabLessons(data.level);
    const keys = curriculum.map((plan) => plan.key);
    const { data: rows, error } = await supabaseAdmin
      .from("lessons")
      .select("curriculum_key, video_url")
      .in("curriculum_key", keys)
      .order("id");
    if (error) throw new Error("The Summary video links could not be loaded");

    return curriculum.map((plan) => {
      const copies = (rows ?? []).filter((row) => row.curriculum_key === plan.key);
      const urlCounts = new Map<string, number>();
      for (const copy of copies) {
        if (copy.video_url) urlCounts.set(copy.video_url, (urlCounts.get(copy.video_url) ?? 0) + 1);
      }
      const videoUrl =
        [...urlCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        key: plan.key,
        unit: plan.unit,
        unitTitle: plan.unitTitle,
        position: plan.position,
        title: plan.title,
        videoUrl,
        copies: copies.length,
        copiesWithVideo: copies.filter((copy) => Boolean(copy.video_url)).length,
        hasConflictingLinks: urlCounts.size > 1,
      };
    });
  });

export const saveSummaryVideoLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ key: z.string().min(3).max(40), url: z.string().trim().min(10).max(300) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { findCurriculumLesson } = await import("@/lib/curriculum");
    const { findBusinessLesson } = await import("@/lib/businessCourse");
    const { canonicalSummaryVideoUrl } = await import("@/lib/lessonVideoReport");
    if (!findCurriculumLesson(data.key) && !findBusinessLesson(data.key, "b1")) {
      throw new Error("Unknown lesson");
    }
    const url = canonicalSummaryVideoUrl(data.url);
    if (!url) throw new Error("Cole um link válido do Vimeo ou YouTube.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updatedRows, error } = await supabaseAdmin
      .from("lessons")
      .update({ video_url: url })
      .eq("curriculum_key", data.key)
      .select("id");
    if (error) throw new Error("The Summary video link could not be saved");
    return { ok: true, url, updated: updatedRows?.length ?? 0 };
  });

export const deleteSummaryVideoLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ key: z.string().min(3).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { findCurriculumLesson } = await import("@/lib/curriculum");
    const { findBusinessLesson } = await import("@/lib/businessCourse");
    if (!findCurriculumLesson(data.key) && !findBusinessLesson(data.key, "b1")) {
      throw new Error("Unknown lesson");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("lessons")
      .update({ video_url: null })
      .eq("curriculum_key", data.key);
    if (error) throw new Error("The Summary video link could not be removed");
    return { ok: true };
  });

// Public dashboard media reads; all writes remain server-side and admin-only.
export const getHomeDashboardImages = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The settings table is shared with the dashboard and is not in generated DB types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("home_media_settings")
    .select("setting_key, image_url");
  if (error) throw new Error("The dashboard images could not be loaded.");

  const result: { desktop: string | null; mobile: string | null; evoAvatar: string | null } = {
    desktop: null,
    mobile: null,
    evoAvatar: null,
  };
  for (const row of data ?? []) {
    if (row.setting_key === "desktop") {
      result.desktop = row.image_url;
    } else if (row.setting_key === "mobile") {
      result.mobile = row.image_url;
    } else if (row.setting_key === "evo-avatar") {
      result.evoAvatar = row.image_url;
    }
  }
  return result;
});

export const saveHomeDashboardImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        target: z.enum(["desktop", "mobile", "evo-avatar"]),
        dataUrl: z.string().min(100).max(4_300_000),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!(await hasAdminRole(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const match = data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    const encodedImage = match?.[2];
    if (!match || match[1] !== data.mimeType || !encodedImage) {
      throw new Error("Choose a valid JPG, PNG or WebP image.");
    }
    const bytes = Uint8Array.from(atob(encodedImage), (character) => character.charCodeAt(0));
    if (bytes.byteLength > 3 * 1024 * 1024) {
      throw new Error("The image must be 3 MB or smaller.");
    }
    const extension =
      data.mimeType === "image/jpeg" ? "jpg" : data.mimeType === "image/png" ? "png" : "webp";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${data.target}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("dashboard-home-images")
      .upload(path, bytes, {
        contentType: data.mimeType,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      throw new Error("The image could not be uploaded. Please try again.");
    }
    const { data: publicData } = supabaseAdmin.storage
      .from("dashboard-home-images")
      .getPublicUrl(path);
    // The settings table is shared with the dashboard and is not in generated DB types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: saveError } = await (supabaseAdmin as any).from("home_media_settings").upsert({
      setting_key: data.target,
      image_url: publicData.publicUrl,
      updated_at: new Date().toISOString(),
    });
    if (saveError) {
      throw new Error("The image was uploaded but could not be published.");
    }
    return { ok: true, url: publicData.publicUrl };
  });

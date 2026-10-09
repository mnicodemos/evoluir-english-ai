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
            .from("premium_campaign_grants" as never)
            .select("user_id, expires_at")
            .in("user_id" as never, ids as never)
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
 * Cost of one call: the stored estimate, or one computed now from its tokens,
 * so a price added to the table later also prices earlier calls.
 */
function rowCost(row: BenchmarkUsageRow): number | null {
  return row.estimated_cost ?? estimateAiCost(row.model, row.input_tokens, row.output_tokens);
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
        label: `${OPERATION_FACTS[operation]?.label ?? operation}${phase ? " · reply (streaming)" : ""}`,
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

// Admin panel backend. Authorization happens server-side only: the signed-in
// user's email comes from the verified token claims, never from the client.
// Reuses the existing auth middleware and the existing profiles table.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAILS = ["mncelo.n@gmail.com"];

function isAdminClaims(claims: Record<string, unknown>): boolean {
  const email = claims["email"];
  if (typeof email !== "string") return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export const isAdminUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    isAdmin: isAdminClaims(context.claims as unknown as Record<string, unknown>),
  }));

export const listRegisteredUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isAdminClaims(context.claims as unknown as Record<string, unknown>)) {
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
  talking: { label: "AI Talking", streaming: "Yes", path: "Primary: Lovable AI" },
  teacher: { label: "AI Teacher", streaming: "No", path: "Primary: Gemini (personal key)" },
  transcription: {
    label: "Transcription",
    streaming: "Yes",
    path: "Primary: Lovable AI · Fallback: Gemini",
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

/** Read-only aggregation of the existing ai_usage_events table. Runs only on admin request. */
export const getAiUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ days: z.number().int().min(1).max(90) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!isAdminClaims(context.claims as unknown as Record<string, unknown>)) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("ai_usage_events")
      .select("operation, model, success, status, duration_ms, input_tokens, output_tokens, error_code")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw error;

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
        };
        map.set(r.operation, a);
      }
      a.calls++;
      a.models.add(r.model);
      if (r.success) a.ok++;
      else if (r.success === false) {
        a.errors++;
        const code = r.error_code ?? "unknown";
        a.errorCodes[code] = (a.errorCodes[code] ?? 0) + 1;
        if (code === "timeout") a.timeouts++;
        if (code === "cancelled" || code === "abandoned") a.cancelled++;
        if (code === "concurrent_limit" || code === "rate_limit" || code.endsWith("_limit"))
          a.blocked++;
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
            .map(([code, n]) => `${code} (${n})`),
          avgMs: d.length ? Math.round(d.reduce((s, v) => s + v, 0) / d.length) : null,
          p95Ms: d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.95))] : null,
          maxMs: d.length ? d[d.length - 1] : null,
          // Tokens only count calls that actually reported them; null = not measured.
          callsWithTokens: a.withTokens,
          inputTokens: a.withTokens ? a.inputTokens : null,
          outputTokens: a.withTokens ? a.outputTokens : null,
          models,
          providers: [...new Set(models.map(providerOf))],
          streaming: facts?.streaming ?? null,
          path: facts?.path ?? null,
        };
      })
      .sort((x, y) => y.calls - x.calls);

    return {
      days: data.days,
      totalCalls: (rows ?? []).length,
      truncated: (rows ?? []).length >= 10000,
      operations,
    };
  });

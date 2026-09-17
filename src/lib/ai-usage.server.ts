export const AI_OPERATIONS = [
  "chat",
  "talking",
  "tts",
  "transcription",
  "lesson_generation",
  "quiz_generation",
  "vocabulary_generation",
  "writing_correction",
  "dictionary",
] as const;

export type AiOperation = (typeof AI_OPERATIONS)[number];

type UsageTicket = { eventId: string; startedAt: number };

export class AiUsageError extends Error {
  status: number;
  code: string;
  retryAfter: number;

  constructor(status: number, code: string, message: string, retryAfter = 0) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function hashAiRequest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function reserveAiUsage(input: {
  userId: string;
  operation: AiOperation;
  model: string;
  requestHash?: string;
}): Promise<UsageTicket> {
  const db = await admin();
  const { data: limit, error: limitError } = await db
    .from("ai_limits")
    .select(
      "daily_limit, monthly_limit, premium_daily_limit, premium_monthly_limit, min_interval_seconds, max_concurrent, enabled",
    )
    .eq("operation", input.operation)
    .single();
  if (limitError || !limit)
    throw new AiUsageError(
      503,
      "limits_unavailable",
      "AI usage controls are temporarily unavailable.",
    );
  if (!limit.enabled)
    throw new AiUsageError(
      503,
      "operation_disabled",
      "This AI feature is temporarily unavailable.",
    );

  const { data, error } = await db.rpc("reserve_ai_usage", {
    p_user_id: input.userId,
    p_operation: input.operation,
    p_model: input.model,
    p_request_hash: input.requestHash ?? "",
    p_daily_limit: limit.daily_limit,
    p_monthly_limit: limit.monthly_limit,
    p_premium_daily_limit: limit.premium_daily_limit,
    p_premium_monthly_limit: limit.premium_monthly_limit,
    p_min_interval_seconds: limit.min_interval_seconds,
    p_max_concurrent: limit.max_concurrent,
  });
  const reservation = data?.[0];
  if (error || !reservation)
    throw new AiUsageError(
      503,
      "limits_unavailable",
      "AI usage controls are temporarily unavailable.",
    );
  if (!reservation.allowed) {
    const messages: Record<string, string> = {
      daily_limit: "You reached today's AI limit. Please try again tomorrow.",
      monthly_limit: "You reached this month's AI limit.",
      concurrent_limit: "Another AI request is already running. Please wait a moment.",
      rate_limit: "Please wait a moment before trying again.",
    };
    throw new AiUsageError(
      429,
      reservation.reason ?? "usage_limit",
      messages[reservation.reason ?? ""] ?? "AI usage is temporarily limited.",
      reservation.retry_after_seconds,
    );
  }
  return { eventId: reservation.event_id, startedAt: Date.now() };
}

export async function finishAiUsage(
  ticket: UsageTicket,
  result: {
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    inputTokens?: number;
    outputTokens?: number;
  },
) {
  const db = await admin();
  await db
    .from("ai_usage_events")
    .update({
      status: result.success ? "completed" : "error",
      success: result.success,
      duration_ms: Math.max(0, Date.now() - ticket.startedAt),
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
      error_code: result.errorCode ?? null,
      error_message: result.errorMessage?.slice(0, 500) ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", ticket.eventId);
}

export async function readAiCache(cacheKey: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("ai_response_cache")
    .select("response_text, hit_count")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await db
    .from("ai_response_cache")
    .update({ hit_count: data.hit_count + 1, last_hit_at: new Date().toISOString() })
    .eq("cache_key", cacheKey);
  return data.response_text;
}

export async function writeAiCache(input: {
  cacheKey: string;
  operation: AiOperation;
  model: string;
  responseText: string;
  ttlSeconds: number;
}) {
  if (input.ttlSeconds <= 0) return;
  const db = await admin();
  await db.from("ai_response_cache").upsert({
    cache_key: input.cacheKey,
    operation: input.operation,
    model: input.model,
    response_text: input.responseText,
    expires_at: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
  });
}

export async function operationCacheTtl(operation: AiOperation): Promise<number> {
  const db = await admin();
  const { data } = await db
    .from("ai_limits")
    .select("cache_ttl_seconds")
    .eq("operation", operation)
    .maybeSingle();
  return data?.cache_ttl_seconds ?? 0;
}

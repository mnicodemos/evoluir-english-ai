import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let limitRow: Record<string, unknown> | null;
let rpcResult: Record<string, unknown>;

function chain(table: string) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  q["select"] = self;
  q["eq"] = self;
  q["lt"] = self;
  q["gt"] = self;
  q["update"] = self;
  q["maybeSingle"] = async () => ({ data: table === "ai_limits" ? limitRow : null, error: null });
  q["then"] = (r: (v: unknown) => void) => r({ data: null, error: null });
  return q;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      calls.push(table);
      return chain(table);
    },
    rpc: async (_name: string, args: Record<string, unknown>) => {
      calls.push(`rpc:${String(args["p_daily_limit"])}`);
      return { data: [rpcResult], error: null };
    },
  },
}));

const { loadAiLimit, reserveAiUsage, AiUsageError } = await import("./ai-usage.server");

const row = {
  daily_limit: 60,
  monthly_limit: 900,
  premium_daily_limit: 300,
  premium_monthly_limit: 5000,
  min_interval_seconds: 1,
  max_concurrent: 2,
  enabled: true,
  cache_ttl_seconds: 86400,
};

beforeEach(() => {
  calls.length = 0;
  limitRow = row;
  rpcResult = { allowed: true, event_id: "e1", reason: null, retry_after_seconds: 0 };
});

describe("single ai_limits read", () => {
  it("returns the same TTL and limits from one query", async () => {
    const limit = await loadAiLimit("dictionary");
    expect(limit?.cache_ttl_seconds).toBe(86400);
    await reserveAiUsage({ userId: "u", operation: "dictionary", model: "m", limit });
    expect(calls.filter((c) => c === "ai_limits")).toHaveLength(1);
    expect(calls).toContain("rpc:60");
  });

  it("still reads ai_limits itself when no row is passed", async () => {
    await reserveAiUsage({ userId: "u", operation: "tts", model: "m" });
    expect(calls.filter((c) => c === "ai_limits")).toHaveLength(1);
  });

  it("keeps blocked, disabled and missing-limit errors", async () => {
    rpcResult = { allowed: false, event_id: "e", reason: "daily_limit", retry_after_seconds: 0 };
    await expect(
      reserveAiUsage({ userId: "u", operation: "tts", model: "m", limit: row }),
    ).rejects.toMatchObject({ status: 429, code: "daily_limit" });
    await expect(
      reserveAiUsage({
        userId: "u",
        operation: "tts",
        model: "m",
        limit: { ...row, enabled: false },
      }),
    ).rejects.toMatchObject({ code: "operation_disabled" });
    limitRow = null;
    await expect(
      reserveAiUsage({ userId: "u", operation: "tts", model: "m", limit: null }),
    ).rejects.toBeInstanceOf(AiUsageError);
  });
});

import { describe, expect, it } from "vitest";

import { aggregateCostPerformance } from "./admin.functions";

describe("aggregateCostPerformance", () => {
  it("groups observed metrics and keeps unavailable costs and misses null", () => {
    const result = aggregateCostPerformance(
      [
        { operation: "dictionary", model: "gemini-3", success: true, duration_ms: 1000, input_tokens: 10, output_tokens: 5, estimated_cost: null },
        { operation: "dictionary", model: "gemini-3", success: false, duration_ms: 3000, input_tokens: null, output_tokens: null, estimated_cost: null },
      ],
      [{ operation: "dictionary", model: "gemini-3", hit_count: 4, expires_at: "2999-01-01T00:00:00.000Z" }],
    );

    expect(result.calls).toBe(2);
    expect(result.operations).toBe(1);
    expect(result.avgMs).toBe(2000);
    expect(result.errorRate).toBe(50);
    expect(result.cacheHits).toBe(4);
    expect(result.estimatedCost).toBeNull();
    expect(result.projectedCost1k).toBeNull();
    expect(result.comparisons[0]).toMatchObject({
      provider: "Gemini (personal key)",
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      tokenCoverage: 1,
      cacheHits: 4,
      cacheMisses: null,
      firstChunkMs: null,
      retries: null,
    });
  });

  it("calculates projections only when every call has recorded cost", () => {
    const result = aggregateCostPerformance(
      [{ operation: "talking", model: "google/gemini", success: true, duration_ms: 500, input_tokens: 2, output_tokens: 3, estimated_cost: 0.01 }],
      [],
    );

    expect(result.estimatedCost).toBe(0.01);
    expect(result.projectedCost1k).toBe(10);
    expect(result.comparisons[0]?.provider).toBe("Lovable AI");
  });
});
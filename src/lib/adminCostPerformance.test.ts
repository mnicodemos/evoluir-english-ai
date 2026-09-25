import { describe, expect, it } from "vitest";

import { aggregateCostPerformance } from "./admin.functions";

describe("aggregateCostPerformance", () => {
  it("groups observed metrics and keeps unavailable costs and misses null", () => {
    const result = aggregateCostPerformance(
      [
        {
          operation: "dictionary",
          model: "gemini-3",
          success: true,
          duration_ms: 1000,
          input_tokens: 10,
          output_tokens: 5,
          estimated_cost: null,
          error_code: null,
        },
        {
          operation: "dictionary",
          model: "gemini-3",
          success: false,
          duration_ms: 3000,
          input_tokens: null,
          output_tokens: null,
          estimated_cost: null,
          error_code: "timeout",
        },
      ],
      [
        {
          operation: "dictionary",
          model: "gemini-3",
          hit_count: 4,
          expires_at: "2999-01-01T00:00:00.000Z",
        },
      ],
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
      cacheMisses: 2,
      firstChunkMs: null,
      retries: null,
      medianMs: null,
      p95Ms: null,
      timeouts: 1,
      cancellations: 0,
    });
  });

  it("calculates projections only when every call has recorded cost", () => {
    const result = aggregateCostPerformance(
      [
        {
          operation: "talking",
          model: "google/gemini",
          success: true,
          duration_ms: 500,
          input_tokens: 2,
          output_tokens: 3,
          estimated_cost: 0.01,
          error_code: null,
        },
      ],
      [],
    );

    expect(result.estimatedCost).toBe(0.01);
    expect(result.projectedCost1k).toBe(10);
    expect(result.comparisons[0]?.provider).toBe("Lovable AI");
  });

  it("calculates median and p95 only with a sufficient sample", () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      operation: "teacher",
      model: "gemini-3.5-flash-lite",
      success: true,
      duration_ms: (index + 1) * 100,
      input_tokens: 1,
      output_tokens: 1,
      estimated_cost: null,
      error_code: null,
    }));
    const result = aggregateCostPerformance(rows, []);
    expect(result.comparisons[0]).toMatchObject({ medianMs: 550, p95Ms: 955 });
  });

  it("does not falsely attribute the historical transcription provider", () => {
    const result = aggregateCostPerformance(
      [
        {
          operation: "transcription",
          model: "gemini-3.5-flash-lite",
          success: true,
          duration_ms: 500,
          input_tokens: null,
          output_tokens: null,
          estimated_cost: null,
          error_code: null,
        },
      ],
      [],
    );
    expect(result.comparisons[0]?.provider).toBe("N/D — provider não registrado");
  });
});

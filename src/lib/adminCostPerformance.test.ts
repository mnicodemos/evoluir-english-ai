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

  it("prices calls from their tokens and shows partial coverage", () => {
    const row = (input: number | null, output: number | null) => ({
      operation: "teacher",
      model: "gemini-3.6-flash",
      success: true,
      duration_ms: 1000,
      input_tokens: input,
      output_tokens: output,
      estimated_cost: null,
      error_code: null,
    });
    const result = aggregateCostPerformance(
      [row(1_000_000, 1_000_000), row(1_000_000, 1_000_000), row(null, null)],
      [],
    );
    // 1M in + 1M out at US$ 1.50 / 7.50 = US$ 9 per measured call.
    expect(result.estimatedCost).toBeCloseTo(18);
    expect(result.costCoverage).toBe(2);
    expect(result.projectedCost1k).toBeCloseTo(9000);
    expect(result.comparisons[0]).toMatchObject({ costCoverage: 2, calls: 3 });
  });

  it("counts only real failures in the error rate", () => {
    const row = (error_code: string | null, success: boolean) => ({
      operation: "lesson_generation",
      model: "gemini-3.6-flash",
      success,
      duration_ms: 1000,
      input_tokens: null,
      output_tokens: null,
      estimated_cost: null,
      error_code,
    });
    const result = aggregateCostPerformance(
      [
        row(null, true),
        row("concurrent_limit", false),
        row("abandoned", false),
        row("gemini_500", false),
      ],
      [],
    );
    expect(result.errorRate).toBe(25);
    expect(result.comparisons[0]).toMatchObject({ errors: 1, blocked: 1, cancellations: 1 });
  });

  it("gives streamed AI Talking replies their own line with the first-word time", () => {
    const talking = (first_chunk_ms: number | null) => ({
      operation: "talking",
      model: "gemini-3.6-flash",
      success: true,
      duration_ms: 4000,
      input_tokens: null,
      output_tokens: null,
      estimated_cost: null,
      error_code: null,
      first_chunk_ms,
    });
    const result = aggregateCostPerformance(
      [talking(null), talking(900), talking(700), talking(1500)],
      [],
    );
    const reply = result.comparisons.find((row) => row.label.includes("reply"));
    const opener = result.comparisons.find((row) => !row.label.includes("reply"));
    expect(reply).toMatchObject({ calls: 3, firstChunkMs: 900, firstChunkCount: 3 });
    expect(opener).toMatchObject({ calls: 1, firstChunkMs: null, firstChunkCount: 0 });
  });
});

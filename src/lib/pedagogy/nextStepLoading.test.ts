import { beforeEach, describe, expect, it, vi } from "vitest";

const { historyReads, client } = vi.hoisted(() => {
  const historyReads: number[] = [];
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        not: () => builder,
        gte: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve({ data: null }),
        limit: (limit: number) => {
          if (table === "assessment_evidence") historyReads.push(limit);
          return builder;
        },
        then: (resolve: (result: { data: never[] }) => unknown) =>
          Promise.resolve({ data: [] }).then(resolve),
      };
      return builder;
    },
  };
  return { historyReads, client };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware() { return this; },
    inputValidator() { return this; },
    handler: (handler: (args: unknown) => unknown) => handler,
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: client }));
vi.mock("./readingSource.server", () => ({
  hasDailyReadingEvidence: async () => false,
  withoutUnmeasuredReading: (rows: unknown[]) => rows,
}));

const { loadNextStep } = await import("./nextStep.functions");
const run = loadNextStep as unknown as (args: {
  context: { userId: string };
  data: { includeLevelHistory: boolean };
}) => Promise<{ skillsByLevel?: unknown[]; activity: { to: string } }>;

describe("next-step history loading", () => {
  beforeEach(() => { historyReads.length = 0; });

  it("Dashboard reads its 400 review evidence rows without the 3000-row history", async () => {
    const result = await run({ context: { userId: "student" }, data: { includeLevelHistory: false } });
    expect(historyReads).toEqual([400]);
    expect(result.skillsByLevel).toEqual([]);
    expect(result.activity.to).toBe("/coach");
  });

  it("My Progress still requests per-level history in addition to review evidence", async () => {
    await run({ context: { userId: "student" }, data: { includeLevelHistory: true } });
    expect(historyReads).toEqual([3000, 400]);
  });
});
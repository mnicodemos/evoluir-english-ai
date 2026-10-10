import { describe, expect, it } from "vitest";

import { expireCampaignPremium } from "./premiumCampaign.server";

type Result = { data: unknown; error: unknown };

/** A query chain that records the profile update and answers each table. */
function fakeAdmin(tables: Record<string, Result>) {
  const updates: { ids: string[]; values: unknown }[] = [];
  const from = (table: string) => {
    let ids: string[] = [];
    let values: unknown;
    const chain: Record<string, unknown> = {
      select: () => chain,
      lte: () => chain,
      eq: () => chain,
      in: (column: string, list: string[]) => {
        if (column === "id" || (column === "user_id" && table === "subscriptions")) ids = list;
        return chain;
      },
      update: (next: unknown) => {
        values = next;
        return chain;
      },
      then: (resolve: (value: Result) => unknown) => {
        if (values) {
          updates.push({ ids, values });
          return resolve({ data: ids.map((id) => ({ id })), error: null });
        }
        return resolve(tables[table] ?? { data: [], error: null });
      },
    };
    return chain;
  };
  return { admin: { from } as never, updates };
}

const now = new Date("2026-10-21T03:00:00Z");

describe("expireCampaignPremium", () => {
  it("puts ended campaign grants back to free", async () => {
    const { admin, updates } = fakeAdmin({
      premium_campaign_grants: { data: [{ user_id: "a" }, { user_id: "b" }], error: null },
      subscriptions: { data: [], error: null },
    });
    expect(await expireCampaignPremium(admin, now)).toBe(2);
    expect(updates).toEqual([{ ids: ["a", "b"], values: { plan: "free", plan_expires_at: null } }]);
  });

  it("keeps Premium for a student who subscribed meanwhile", async () => {
    const { admin, updates } = fakeAdmin({
      premium_campaign_grants: { data: [{ user_id: "a" }, { user_id: "b" }], error: null },
      subscriptions: {
        data: [
          { user_id: "a", status: "active", current_period_end: "2026-11-21T00:00:00Z" },
          { user_id: "b", status: "active", current_period_end: "2026-10-01T00:00:00Z" },
        ],
        error: null,
      },
    });
    expect(await expireCampaignPremium(admin, now)).toBe(1);
    expect(updates[0]?.ids).toEqual(["b"]);
  });

  it("does nothing before the migration or when no grant ended", async () => {
    const missing = fakeAdmin({
      premium_campaign_grants: { data: null, error: { code: "42P01" } },
    });
    expect(await expireCampaignPremium(missing.admin, now)).toBe(0);
    const none = fakeAdmin({ premium_campaign_grants: { data: [], error: null } });
    expect(await expireCampaignPremium(none.admin, now)).toBe(0);
    expect([...missing.updates, ...none.updates]).toHaveLength(0);
  });
});

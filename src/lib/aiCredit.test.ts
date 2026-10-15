import { describe, expect, it } from "vitest";

import { creditBalance } from "./aiCredit";

const topup = (amount: number, added_at: string) => ({
  id: added_at,
  added_at,
  amount_usd: amount,
  note: null,
});

describe("API credit balance", () => {
  it("subtracts the measured cost from every top-up since the first one", () => {
    const balance = creditBalance(
      [topup(20, "2026-10-12T00:00:00Z"), topup(10, "2026-10-01T00:00:00Z")],
      12.5,
    );
    expect(balance).toMatchObject({
      loadedUsd: 30,
      spentUsd: 12.5,
      remainingUsd: 17.5,
      low: false,
      since: "2026-10-01T00:00:00Z",
    });
  });

  it("warns when less than a fifth of the credit is left", () => {
    expect(creditBalance([topup(10, "2026-10-01T00:00:00Z")], 8.5).low).toBe(true);
  });

  it("has no share before the first top-up", () => {
    expect(creditBalance([], 3)).toMatchObject({ remainingShare: null, low: false, since: null });
  });
});

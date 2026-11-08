import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { refreshAfterActivity } from "./refreshKeys";

describe("daily progress refresh", () => {
  it("refreshes daily metrics and both credited-day counts after study", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    await refreshAfterActivity(client);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["today-study-metrics"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["qualified-study-days"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["total-credited-study-days"] });
  });
});

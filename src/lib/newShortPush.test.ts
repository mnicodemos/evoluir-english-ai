import { describe, expect, it } from "vitest";

import { NEW_SHORT_PATH, newShortPush } from "./newShortPush";

describe("new short push", () => {
  it("invites a Premium student to watch it", () => {
    const push = newShortPush("  Phrasal verbs in 30 seconds ", true);
    expect(push.title).toBe("🎬 Novo Short no seu nível");
    expect(push.body).toBe("Phrasal verbs in 30 seconds. Assista agora em Vídeos extras.");
    expect(push.path).toBe(NEW_SHORT_PATH);
  });

  it("tells a free student it is part of Premium", () => {
    expect(newShortPush("Ordering coffee", false).body).toContain("Premium");
  });

  it("keeps a long title short", () => {
    expect(newShortPush("x".repeat(200), true).body.length).toBeLessThan(130);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bodies: Record<string, unknown>[] = [];
let rejectThinking = false;

beforeEach(() => {
  bodies.length = 0;
  process.env["LOVABLE_API_KEY"] = "k";
  process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"] = "c";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { generationConfig: Record<string, unknown> };
      bodies.push(body.generationConfig);
      if (rejectThinking && body.generationConfig["thinkingConfig"])
        return new Response("thinking not supported", { status: 400 });
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
        { status: 200 },
      );
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("Gemini speed settings", () => {
  it("fast calls turn thinking off and cap the answer; normal calls are unchanged", async () => {
    const { callGemini } = await import("./gemini.server");
    await callGemini([{ role: "user", content: "hi" }], false, undefined, undefined, {
      fast: true,
      maxOutputTokens: 300,
    });
    await callGemini([{ role: "user", content: "hi" }], false);
    expect(bodies[0]).toEqual({ maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } });
    expect(bodies[1]).toEqual({});
  });

  it("a model that refuses thinkingConfig is retried plain once and remembered", async () => {
    vi.resetModules();
    rejectThinking = true;
    const { callGemini } = await import("./gemini.server");
    const speed = { fast: true, maxOutputTokens: 300 };
    expect(
      await callGemini([{ role: "user", content: "a" }], false, undefined, undefined, speed),
    ).toBe("ok");
    expect(bodies).toEqual([{ maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } }, {}]);
    bodies.length = 0;
    await callGemini([{ role: "user", content: "b" }], false, undefined, undefined, speed);
    expect(bodies).toEqual([{}]);
    rejectThinking = false;
  });
});

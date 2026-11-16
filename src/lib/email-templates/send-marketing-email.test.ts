import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-email/render", () => ({
  render: vi.fn(async (_element: unknown, options?: { plainText?: boolean }) =>
    options?.plainText ? "Premium benefits in plain text" : "<html>Premium benefits</html>",
  ),
}));
vi.mock("./registry", () => ({
  TEMPLATES: {
    "premium-benefits": {
      component: () => null,
      subject: "Conheça os benefícios do Evoluir+ Premium",
    },
  },
}));

import { sendMarketingEmail } from "./send-marketing-email";

const originalApiKey = process.env["RESEND_API_KEY"];
const originalFrom = process.env["RESEND_FROM_EMAIL"];

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env["RESEND_API_KEY"];
  else process.env["RESEND_API_KEY"] = originalApiKey;
  if (originalFrom === undefined) delete process.env["RESEND_FROM_EMAIL"];
  else process.env["RESEND_FROM_EMAIL"] = originalFrom;
});

describe("sendMarketingEmail", () => {
  it("renders and sends the Premium template through Resend", async () => {
    process.env["RESEND_API_KEY"] = "test-resend-key";
    process.env["RESEND_FROM_EMAIL"] = "Evoluir+ English AI <noreply@example.com>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_test_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendMarketingEmail("premium-benefits", "student@example.com", {
        templateData: { lang: "pt", studentName: "Student" },
        idempotencyKey: "premium-test-key",
      }),
    ).resolves.toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(request.method).toBe("POST");
    expect((request.headers as Record<string, string>)["Idempotency-Key"]).toBe("premium-test-key");
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body["to"]).toEqual(["student@example.com"]);
    expect(body["from"]).toBe("Evoluir+ English AI <noreply@example.com>");
    expect(body["subject"]).toBe("Conheça os benefícios do Evoluir+ Premium");
    expect(body["html"]).toContain("Premium benefits");
    expect(body["text"]).toContain("plain text");
  });

  it("surfaces Resend 4xx and 5xx response messages", async () => {
    process.env["RESEND_API_KEY"] = "test-resend-key";
    for (const status of [422, 500]) {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Resend rejected the request" }), { status }),
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        sendMarketingEmail("premium-benefits", "student@example.com"),
      ).rejects.toThrow(`Resend marketing email failed (${status}): Resend rejected the request`);
    }
  });

  it("requires the Resend API key before making a request", async () => {
    delete process.env["RESEND_API_KEY"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendMarketingEmail("premium-benefits", "student@example.com"),
    ).rejects.toThrow("RESEND_API_KEY is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

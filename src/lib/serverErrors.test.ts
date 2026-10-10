import { describe, expect, it } from "vitest";

import { describeServerError, scrubErrorText, serverErrorAlerts } from "./serverErrors";

const now = new Date("2026-10-10T13:00:00Z");

describe("describeServerError", () => {
  it("names the area from the log prefix and keeps the detail", () => {
    expect(describeServerError(["[stripe] failed to process invoice.paid", "boom"])).toEqual({
      area: "Pagamentos (Stripe)",
      message: "[stripe] failed to process invoice.paid · boom",
    });
    expect(describeServerError(["daily-push: admin alert failed", new Error("timeout")])).toEqual({
      area: "Notificações",
      message: "daily-push: admin alert failed · Error: timeout",
    });
  });

  it("files unknown errors under Servidor, first line only", () => {
    const error = new TypeError("Cannot read properties of undefined");
    error.stack = "TypeError: Cannot read properties of undefined\n    at secret.ts:1";
    expect(describeServerError([error])).toEqual({
      area: "Servidor",
      message: "TypeError: Cannot read properties of undefined",
    });
  });

  it("skips what other alerts already measure or what is expected", () => {
    expect(describeServerError(["Gemini attempt 1/2 failed [503] on m: busy"])).toBeNull();
    expect(describeServerError(["Lesson content failed strict validation", "a1-u1"])).toBeNull();
    expect(describeServerError(["FCM send failed [404]: UNREGISTERED"])).toBeNull();
    expect(describeServerError([])).toBeNull();
  });
});

describe("scrubErrorText", () => {
  it("removes emails, ids and tokens", () => {
    const text = scrubErrorText(
      "user ana@mail.com 3f2a1b4c-1111-2222-3333-444455556666 key tok_FAKE0abcdefghijklmnopqrstuvwxyz01234",
    );
    expect(text).toBe("user <email> <id> key <token>");
  });

  it("keeps messages short", () => {
    expect(scrubErrorText("x ".repeat(400)).length).toBeLessThanOrEqual(240);
  });
});

describe("serverErrorAlerts", () => {
  const row = (area: string, created_at: string, message = "m") => ({ area, message, created_at });

  it("is quiet without errors in the last 24 h", () => {
    expect(serverErrorAlerts([row("Servidor", "2026-10-09T10:00:00Z")], now)).toEqual([]);
  });

  it("sums by area, warns below five and flags five or more as an error", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => row("Voz (TTS)", `2026-10-10T1${i}:00:00Z`, `v${i}`)),
      row("Servidor", "2026-10-10T09:00:00Z"),
    ];
    const alerts = serverErrorAlerts(rows, now);
    expect(alerts.map((alert) => [alert.level, alert.title])).toEqual([
      ["error", "Voz (TTS): 5 erro(s) no servidor em 24 h"],
      ["warning", "Servidor: 1 erro(s) no servidor em 24 h"],
    ]);
    expect(alerts[0]!.detail).toBe("Último: v4");
  });
});

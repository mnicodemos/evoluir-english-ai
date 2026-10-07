import { describe, expect, it } from "vitest";

import { adminAlertPush, aiAlerts, pushAlerts, type AiCall, type PushRun } from "./opsAlerts";

const now = new Date("2026-10-07T13:00:00Z");
const run = (over: Partial<PushRun>): PushRun => ({
  kind: "word",
  created_at: "2026-10-07T12:00:00Z",
  devices: 2,
  sent: 2,
  failed: 0,
  error: null,
  ...over,
});
const call = (over: Partial<AiCall>): AiCall => ({
  operation: "talking",
  created_at: "2026-10-07T10:00:00Z",
  success: true,
  status: "completed",
  error_code: null,
  error_message: null,
  ...over,
});

describe("pushAlerts", () => {
  it("is quiet when both daily jobs ran and delivered", () => {
    const runs = [run({}), run({ kind: "reminder", created_at: "2026-10-06T22:00:00Z" })];
    expect(pushAlerts(runs, now)).toEqual([]);
  });

  it("counts Sunday's weekly report as the evening job", () => {
    const runs = [run({}), run({ kind: "weekly", created_at: "2026-10-06T22:00:00Z" })];
    expect(pushAlerts(runs, now)).toEqual([]);
  });

  it("flags a job that has not run for more than a day", () => {
    const runs = [
      run({ created_at: "2026-10-05T12:00:00Z" }),
      run({ kind: "reminder", created_at: "2026-10-06T22:00:00Z" }),
    ];
    const [alert] = pushAlerts(runs, now);
    expect(alert?.level).toBe("error");
    expect(alert?.title).toContain("Palavra do dia");
    expect(alert?.title).toContain("49 h");
  });

  it("flags a run that failed or reached no device", () => {
    const failed = pushAlerts(
      [run({ error: "Push not configured" }), run({ kind: "reminder" })],
      now,
    );
    expect(failed[0]).toMatchObject({ level: "error", detail: "Push not configured" });
    const nobody = pushAlerts([run({ sent: 0, failed: 2 }), run({ kind: "reminder" })], now);
    expect(nobody[0]?.title).toContain("nenhum aparelho recebeu");
  });

  it("only warns when some devices still received the push", () => {
    const partial = pushAlerts([run({ sent: 1, failed: 1 }), run({ kind: "reminder" })], now);
    expect(partial).toHaveLength(1);
    expect(partial[0]?.level).toBe("warning");
  });

  it("warns, without alarm, before the first run is recorded", () => {
    const alerts = pushAlerts([], now);
    expect(alerts).toHaveLength(2);
    expect(alerts.every((alert) => alert.level === "warning")).toBe(true);
  });
});

describe("aiAlerts", () => {
  it("ignores the student's side (page closed, silence) and old calls", () => {
    const calls = [
      call({ success: false, status: "error", error_code: "abandoned" }),
      call({ success: false, status: "error", error_code: "empty_transcript" }),
      call({ success: false, status: "error", created_at: "2026-10-05T10:00:00Z" }),
    ];
    expect(aiAlerts(calls, now)).toEqual([]);
  });

  it("warns on a few failures and alarms when many calls fail", () => {
    const one = aiAlerts(
      [call({}), call({}), call({ success: false, status: "error", error_message: "502" })],
      now,
    );
    expect(one).toEqual([
      expect.objectContaining({ level: "warning", detail: "Último erro: 502" }),
    ]);
    const many = aiAlerts(
      [
        call({}),
        ...Array.from({ length: 3 }, () =>
          call({ operation: "writing_correction", success: false, status: "error" }),
        ),
      ],
      now,
    );
    expect(many[0]).toMatchObject({ level: "error", title: expect.stringContaining("3 de 3") });
  });
});

describe("adminAlertPush", () => {
  it("pushes only for errors, pointing to the Admin", () => {
    expect(adminAlertPush([{ level: "warning", area: "ai", title: "x", detail: "" }])).toBeNull();
    const push = adminAlertPush([
      { level: "error", area: "push", title: "Palavra do dia: falhou", detail: "" },
      { level: "error", area: "ai", title: "IA: falhas", detail: "" },
    ]);
    expect(push).toEqual({
      title: "⚠️ Evoluir+: 2 alertas",
      body: "Palavra do dia: falhou · e mais 1",
      path: "/admin",
    });
  });
});

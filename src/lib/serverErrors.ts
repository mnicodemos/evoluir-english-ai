// Server errors for the owner: every console.error on the server is reduced to
// an area and a short, scrubbed message (no emails, ids or tokens), stored in
// server_errors, and summed up in the Admin "Alerts" box. Pure rules, tested.

import type { OpsAlert } from "@/lib/opsAlerts";

export type ServerErrorRow = { area: string; message: string; created_at: string };

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** From this many errors of one area in 24 h, the alert is an error (pushed to admins). */
const ERROR_THRESHOLD = 5;
const MESSAGE_LIMIT = 240;

/** Prefixes used by the server's own console.error calls, in Portuguese for the Admin. */
const AREAS: Array<[RegExp, string]> = [
  [/^\[speech\]|^\[tts-cache\]/i, "Voz (TTS)"],
  [/^Gemini talking/i, "Conversa (voz)"],
  [/^\[stripe\]/i, "Pagamentos (Stripe)"],
  [/^daily-push|FCM/i, "Notificações"],
  [/^\[vocabulary\]/i, "Vocabulário"],
  [/^\[Supabase\]/i, "Banco de dados"],
  [/pedagogical|mistake could not be stored/i, "Registro pedagógico"],
  [/lesson|YouTube/i, "Lições"],
];

/** Already measured elsewhere or expected: AI retries and failures are in
 *  ai_usage_events (AI alerts), a salvaged lesson keeps its valid items, and a
 *  phone that uninstalled the app answers 404 to its push. */
const IGNORED = [
  /^Gemini (attempt|transcription failed|returned an empty answer)/i,
  /^Lesson content failed strict validation/i,
  /send failed \[404\]/i,
];

/** The first line of every text and Error argument: a prefix plus its detail. */
function errorText(args: unknown[]): string {
  const parts = args
    .map((arg) =>
      typeof arg === "string" ? arg : arg instanceof Error ? `${arg.name}: ${arg.message}` : "",
    )
    .map((part) => part.split("\n")[0]!.trim())
    .filter(Boolean);
  return parts.join(" · ");
}

/** Removes anything that could identify a person or unlock an account. */
export function scrubErrorText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_\-.]{32,}\b/g, "<token>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MESSAGE_LIMIT);
}

/** Area and message for one console.error call; null for noise not worth storing. */
export function describeServerError(args: unknown[]): { area: string; message: string } | null {
  const text = errorText(args);
  if (!text || IGNORED.some((pattern) => pattern.test(text))) return null;
  const area = AREAS.find(([pattern]) => pattern.test(text))?.[1] ?? "Servidor";
  return { area, message: scrubErrorText(text) };
}

export function serverErrorAlerts(rows: ServerErrorRow[], now: Date): OpsAlert[] {
  const since = now.getTime() - WINDOW_MS;
  const byArea = new Map<string, ServerErrorRow[]>();
  for (const row of rows) {
    if (new Date(row.created_at).getTime() < since) continue;
    byArea.set(row.area, [...(byArea.get(row.area) ?? []), row]);
  }
  const alerts: OpsAlert[] = [];
  for (const [area, list] of byArea) {
    const latest = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!;
    alerts.push({
      level: list.length >= ERROR_THRESHOLD ? "error" : "warning",
      area: "server",
      title: `${area}: ${list.length} erro(s) no servidor em 24 h`,
      detail: `Último: ${latest.message}`,
    });
  }
  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
}

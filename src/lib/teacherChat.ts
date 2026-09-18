// Pure UI helpers for the AI Teacher chat surface. No pedagogical logic lives
// here: scores, CEFR, confidence, skills and evidence stay server-side.

export const TEACHER_MESSAGE_MAX = 2000;
export const TEACHER_HISTORY_MAX = 20;

export type TeacherChatMessage = { role: "user" | "assistant"; content: string };

/** Frontend validation only: mirrors the backend contract (1..2000 chars). */
export function validateTeacherMessage(input: string): { ok: boolean; value: string } {
  const value = input.trim();
  if (!value) return { ok: false, value };
  return { ok: value.length <= TEACHER_MESSAGE_MAX, value };
}

/** Only the recent turns the backend accepts, oldest first. */
export function buildTeacherHistory(messages: TeacherChatMessage[]): TeacherChatMessage[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-TEACHER_HISTORY_MAX)
    .map((m) => ({ role: m.role, content: m.content.slice(0, TEACHER_MESSAGE_MAX) }));
}

/** Friendly, non-technical error copy. Never exposes internals. */
export function teacherErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  if (/429|quota|limit/i.test(raw)) return "quota";
  if (/401|403|unauthorized|authorization/i.test(raw)) return "auth";
  if (/network|fetch|timeout|timed out|503|502|504/i.test(raw)) return "network";
  return "unknown";
}

/** Normalises whatever is stored in ai_conversations.messages into chat turns. */
export function parseStoredMessages(value: unknown): TeacherChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { role?: unknown; content?: unknown };
    if (row.role !== "user" && row.role !== "assistant") return [];
    if (typeof row.content !== "string" || !row.content.trim()) return [];
    return [{ role: row.role, content: row.content }];
  });
}

// AI Teacher session rhythm and mistake capture (pure, tested).
import type { TeacherMistake } from "./teacherPrompt";

/** Free chat closes with a recap every this many student messages. */
export const TEACHER_RECAP_EVERY = 6;

/** True when the student's new message is the 6th, 12th... of the chat. */
export function isTeacherRecapTurn(history: { role: "user" | "assistant" }[]): boolean {
  const studentTurns = history.filter((message) => message.role === "user").length + 1;
  return studentTurns % TEACHER_RECAP_EVERY === 0;
}

/**
 * The model's mistake, kept only when its wrong words really appear in the
 * student's message (the model must never put words in the student's mouth)
 * and the correction actually differs.
 */
export function teacherMistakeInMessage(
  mistake: TeacherMistake | null,
  message: string,
): TeacherMistake | null {
  if (!mistake) return null;
  const squash = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
  const original = squash(mistake.original);
  if (!original || !squash(message).includes(original)) return null;
  if (squash(mistake.corrected) === original) return null;
  return mistake;
}

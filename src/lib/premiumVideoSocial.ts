/**
 * Likes and comments on the Premium extra videos (owner request, 2026-10-31;
 * migration 0103_premium_video_social). Pure rules shared by the server and
 * the screen: how another student is named and what a comment may hold.
 */

export const COMMENT_MAX_LENGTH = 500;
/** At most this many comments per student in a rolling hour. */
export const COMMENTS_PER_HOUR = 10;
/** How many comments a video's panel loads, newest first. */
export const COMMENTS_PAGE = 100;

/**
 * Other students see a commenter only by first name and initial, like the
 * weekly league: "Marcelo Nicodemos" → "Marcelo N.".
 */
export function commentAuthorName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Student";
  const first = parts[0]!.slice(0, 40);
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|io|me|ly|app|link)\b)/i;
const CONTACT = /(\b\d[\d\s().-]{8,}\d\b|@[a-z0-9_.]{3,}|\b[\w.+-]+@[\w-]+\.[\w.]+\b)/i;

export type CommentCheck = { ok: true; body: string } | { ok: false; reason: string };

/**
 * A comment as it will be stored, or why it is refused: 1 to 500 characters
 * after trimming, no links and no phone numbers, e-mails or @handles (the app
 * may be used by minors, so contact details never pass between students).
 */
export function checkComment(input: string): CommentCheck {
  const body = input.replace(/\s+/g, " ").trim();
  if (!body) return { ok: false, reason: "Write a comment first." };
  if (body.length > COMMENT_MAX_LENGTH)
    return { ok: false, reason: "Keep your comment under 500 characters." };
  if (LINK.test(body)) return { ok: false, reason: "Comments cannot have links." };
  if (CONTACT.test(body)) return { ok: false, reason: "Comments cannot have contact details." };
  return { ok: true, body };
}

/**
 * Moderation (owner request, 2026-10-31): a comment reported by this many
 * students is hidden from everyone but its author until the owner keeps it
 * (clearing its reports) or deletes it in the Admin.
 */
export const HIDE_AFTER_REPORTS = 3;

export function hiddenByReports(reports: number): boolean {
  return reports >= HIDE_AFTER_REPORTS;
}

/** The admins' push for a comment's first report: who, which video and the start of it. */
export function reportedCommentPush(comment: { author: string; body: string }, video: string) {
  const excerpt = comment.body.length > 80 ? `${comment.body.slice(0, 79)}…` : comment.body;
  return {
    title: "🚩 Comentário denunciado",
    body: `${comment.author}${video ? ` em "${video}"` : ""}: ${excerpt}`,
    path: "/admin",
  };
}

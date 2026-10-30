/**
 * Lesson videos are Vimeo only (owner decision, 2026-10-29). The one stored
 * form of a Vimeo link, used by the Admin's Summary video links and by the
 * server when it gives a new lesson its video. The YouTube report and search
 * that lived here were removed (cleanup, 2026-10-30).
 */
import { vimeoVideoId } from "./lessonVideoDisplay";

/** Canonical Vimeo URL accepted by the admin video manager. */
export function canonicalVimeoUrl(input: string): string | null {
  const clean = input.trim();
  const id = vimeoVideoId(clean);
  if (!id) return null;
  try {
    const parsed = new URL(clean);
    const pathMatch = parsed.pathname.match(/^\/(?:video\/)?\d+\/([A-Za-z0-9]+)\/?$/);
    const hash = parsed.searchParams.get("h") ?? pathMatch?.[1] ?? null;
    return `https://vimeo.com/${id}${hash ? `?h=${encodeURIComponent(hash)}` : ""}`;
  } catch {
    return null;
  }
}

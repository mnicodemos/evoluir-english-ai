/** Browser helpers for POST /api/music (Music Lab). The server verifies the bearer token. */

export const MUSIC_SIGN_IN_MESSAGE = "Your session has expired. Please sign in again to create a song.";

export function musicRequestHeaders(accessToken: string | null | undefined): Record<string, string> | null {
  if (!accessToken) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
}

/** A safe message per status; never shows raw server or provider details. */
export function musicErrorMessage(status: number, serverMessage?: string | null): string {
  if (status === 401) return MUSIC_SIGN_IN_MESSAGE;
  if (status === 429)
    return serverMessage?.includes("24 hours")
      ? serverMessage
      : "The music service is busy right now. Please try again in a few minutes.";
  if (status === 502) return "The music service could not create your song. Please try again.";
  if (status === 503) return "Music generation is temporarily unavailable. Please try again later.";
  return serverMessage || "Music generation is unavailable right now.";
}

/** Safely recognizes Vimeo Player API completion messages. */
export function isVimeoEndedMessage(data: unknown): boolean {
  let payload = data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      return false;
    }
  }
  return (
    typeof payload === "object" &&
    payload !== null &&
    "event" in payload &&
    payload.event === "ended"
  );
}

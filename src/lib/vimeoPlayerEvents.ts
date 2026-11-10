/** Parse Vimeo Player API messages sent as objects or JSON strings. */
export function vimeoPlayerEvent(data: unknown): string | null {
  let payload = data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      return null;
    }
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("event" in payload) ||
    typeof payload.event !== "string"
  ) {
    return null;
  }
  return payload.event;
}

/** Vimeo emits ready after the iframe Player API is initialized. */
export function isVimeoReadyMessage(data: unknown): boolean {
  return vimeoPlayerEvent(data) === "ready";
}

/** Completion is only the Player API's ended event, never play/progress/load. */
export function isVimeoEndedMessage(data: unknown): boolean {
  return vimeoPlayerEvent(data) === "ended";
}

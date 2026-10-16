/**
 * A short vibration where the phone allows it (Android; iPhone browsers ignore
 * it): a tap when something is ticked, a little pattern when a goal is reached
 * (user request: a sophisticated app). Never throws.
 */
export function haptic(kind: "tap" | "success") {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "tap" ? 12 : [18, 50, 28]);
    }
  } catch {
    // Vibration blocked: the visual feedback is enough.
  }
}

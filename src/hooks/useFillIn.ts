import { useEffect, useState } from "react";

/**
 * One fill-in for the Dashboard's progress shapes (user request, 2026-10-24:
 * a premium touch instead of gradients): gauges and bars start empty and grow
 * to their value with FILL_IN_TRANSITION, and later changes glide the same
 * way. People who ask for reduced motion see the value at once.
 */
export const FILL_IN_TRANSITION =
  "duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function useFillIn(value: number) {
  const [shown, setShown] = useState(() =>
    typeof window !== "undefined" && prefersReducedMotion() ? value : 0,
  );
  useEffect(() => {
    // Two frames, so the browser paints the empty shape before it grows.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(value));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [value]);
  return shown;
}

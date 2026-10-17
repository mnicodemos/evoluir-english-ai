import type { SVGProps } from "react";

/**
 * The Focus (Pomodoro) mark: a red tomato with its green leaves, drawn to sit
 * beside the line icons of the header capsule (user request: a tomato instead
 * of a stopwatch; an emoji changes shape from phone to phone).
 */
export function TomatoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 7c-5.2 0-8.8 3-8.8 7.1 0 4.1 3.8 7.1 8.8 7.1s8.8-3 8.8-7.1C20.8 10 17.2 7 12 7Z"
        fill="#ef4444"
      />
      <path
        d="M7.4 11.2c.6-1 1.6-1.6 2.6-1.9"
        stroke="#fecaca"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".7"
      />
      <path
        d="M12 7.6 9.2 5.9l1.9 2.3-2.9.7 3.3.5L12 11l.5-1.6 3.3-.5-2.9-.7 1.9-2.3L12 7.6Z"
        fill="#22c55e"
        stroke="#22c55e"
        strokeWidth=".8"
        strokeLinejoin="round"
      />
      <path d="M12 7.6V3.8" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

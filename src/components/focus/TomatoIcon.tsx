import type { SVGProps } from "react";

/**
 * The Focus (Pomodoro) mark: a tomato drawn like the app's other icons (user
 * request: Lucide's 24 px grid, 2 px round strokes in currentColor, no fill),
 * coloured red where it is used. An emoji would change shape from phone to phone.
 */
export function TomatoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 6.9C4.9 8 3 10.7 3 13.9 3 18.4 7 22 12 22s9-3.6 9-8.1c0-3.2-1.9-5.9-5-7" />
      <path d="M12 6.5V2" />
      <path d="m8.5 4.5 3.5 2 3.5-2" />
      <path d="m7.5 9.5 4.5-3 4.5 3" />
    </svg>
  );
}

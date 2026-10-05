import { alignLetters, closestHeard, missedParts } from "@/lib/pronunciationDiff";

/**
 * Shows the target word with the letters that were not heard highlighted, and
 * names those parts, so a low score says where to improve.
 */
export function PronunciationHint({
  target,
  spoken,
  pt,
}: {
  target: string;
  spoken: string;
  pt: boolean;
}) {
  const heard = closestHeard(target, spoken);
  const matches = alignLetters(target, heard);
  const parts = missedParts(matches);
  return (
    <span className="mt-1 block space-y-1">
      <span className="block font-mono text-base tracking-wide" aria-hidden="true">
        {matches.map((match, index) => (
          <span
            key={index}
            className={
              match.ok
                ? "text-foreground"
                : "rounded-sm bg-destructive/15 text-destructive underline"
            }
          >
            {match.char}
          </span>
        ))}
      </span>
      {parts.length > 0 && (
        <span className="block text-xs">
          {pt ? "Atenção ao som de: " : "Focus on the sound of: "}
          {parts.map((part) => `“${part}”`).join(", ")}
        </span>
      )}
    </span>
  );
}

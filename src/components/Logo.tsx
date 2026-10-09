import symbolDark from "@/assets/evoluir-symbol-dark.webp";
import symbolLight from "@/assets/evoluir-symbol-light.webp";

/**
 * The Evoluir+ symbol (owner's artwork: the flowing strokes with the
 * turquoise geometry above), on a transparent background instead of the old
 * white circle. Dark screens get light strokes; light screens dark strokes.
 */
export function Logo({ className = "size-[2.2rem]" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={symbolDark}
        alt="Evoluir+ English AI logo"
        width={512}
        height={512}
        className="block size-full object-contain dark:hidden"
      />
      <img
        src={symbolLight}
        alt="Evoluir+ English AI logo"
        width={512}
        height={512}
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}

import symbolDark from "@/assets/evoluir-symbol-dark.webp";
import symbolLight from "@/assets/evoluir-symbol-light.webp";

/**
 * The Evoluir+ symbol (owner's artwork: the flowing strokes with the
 * turquoise geometry above), cut tight on a transparent background. The size
 * class sets its height; the width follows the artwork (about 1:2), so it is
 * never stretched and sits right next to the app name. Dark screens get light
 * strokes; light screens dark strokes.
 */
export function Logo({ className = "size-[2.2rem]" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`} style={{ width: "auto" }}>
      <img
        src={symbolDark}
        alt="Evoluir+ English AI logo"
        width={255}
        height={512}
        className="block h-full w-auto dark:hidden"
      />
      <img
        src={symbolLight}
        alt="Evoluir+ English AI logo"
        width={255}
        height={512}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}

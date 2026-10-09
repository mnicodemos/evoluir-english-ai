import symbolDark from "@/assets/evoluir-symbol-dark.webp";
import symbolLight from "@/assets/evoluir-symbol-light.webp";

/**
 * The Evoluir+ symbol (owner's artwork: the flowing strokes with the
 * turquoise geometry above), cut tight on a transparent background. The size
 * class sets its slot height and the artwork fills 70% of it (user request:
 * smaller, about 1.5x the app name's line); the width follows the artwork (about 1:2), so it is
 * never stretched and sits right next to the app name. Dark screens get light
 * strokes; light screens dark strokes. The dark-screen image comes first,
 * since every screen of the app is dark (the first image is the visible one).
 */
export function Logo({ className = "size-[2.2rem]" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`} style={{ width: "auto" }}>
      <img
        src={symbolLight}
        alt="Evoluir+ English AI logo"
        width={255}
        height={512}
        className="hidden h-[70%] w-auto dark:block"
      />
      <img
        src={symbolDark}
        alt="Evoluir+ English AI logo"
        width={255}
        height={512}
        className="block h-[70%] w-auto dark:hidden"
      />
    </span>
  );
}

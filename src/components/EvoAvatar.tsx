import evoGuide from "@/assets/evo-guide.webp";
import { cn } from "@/lib/utils";

/** The owner's round EVO portrait, shared wherever EVO speaks to the student. */
export function EvoAvatar({ className }: { className?: string }) {
  return (
    <img
      src={evoGuide}
      alt="EVO"
      width={192}
      height={192}
      className={cn(
        "size-12 shrink-0 rounded-full object-cover ring-2 ring-brand-green/60 sm:size-14",
        className,
      )}
    />
  );
}

import evoGuide from "@/assets/evo-guide.webp";
import { useHomeImages } from "@/hooks/useHomeImages";
import { cn } from "@/lib/utils";

/** EVO portrait reserved for English Adventures; never changes the global EVO avatar. */
export function EnglishAdventuresAvatar({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  const { data } = useHomeImages();
  return (
    <img
      src={data?.englishAdventuresAvatar ?? evoGuide}
      alt={decorative ? "" : "EVO"}
      width={192}
      height={192}
      className={cn("size-12 shrink-0 rounded-full object-cover object-[50%_15%] sm:size-14", className)}
    />
  );
}

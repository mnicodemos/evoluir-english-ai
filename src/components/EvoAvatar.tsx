import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import evoGuide from "@/assets/evo-guide.webp";
import { getHomeDashboardImages } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

/** The owner's round EVO portrait, shared wherever EVO speaks to the student. */
export function EvoAvatar({
  className,
  decorative = false,
}: {
  className?: string;
  /** True when a visible label beside it already names EVO. */
  decorative?: boolean;
}) {
  const loadHomeImages = useServerFn(getHomeDashboardImages);
  const { data } = useQuery({
    queryKey: ["home-dashboard-image-public"],
    queryFn: () => loadHomeImages(),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <img
      src={data?.evoAvatar ?? evoGuide}
      alt={decorative ? "" : "EVO"}
      width={192}
      height={192}
      className={cn(
        "size-12 shrink-0 rounded-full object-cover ring-2 ring-brand-green/60 sm:size-14",
        className,
      )}
    />
  );
}

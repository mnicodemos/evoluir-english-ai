import { cn } from "@/lib/utils";

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold", className)}>
      Evoluir<span className="text-brand-green">+</span> English AI
    </span>
  );
}
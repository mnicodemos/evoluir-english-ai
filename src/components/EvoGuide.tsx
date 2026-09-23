import type { ReactNode } from "react";

import evoBust from "@/assets/evo-bust.png.asset.json";
import { cn } from "@/lib/utils";

type EvoGuideProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function EvoGuide({ title, description, children, className }: EvoGuideProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-4",
        className,
      )}
    >
      <div className="aspect-[339/452] w-full overflow-hidden rounded-lg bg-secondary">
        <img
          src={evoBust.url}
          alt="EVO, sua companheira de evolução em inglês"
          width={339}
          height={452}
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-primary">EVO</p>
        <h2 className="mt-1 text-base font-semibold text-card-foreground sm:text-lg">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

import evoGuideOfficial from "@/assets/evo-guide-official.png.asset.json";
import { cn } from "@/lib/utils";

type EvoGuideProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  imageSize?: "default" | "dashboard";
};

export function EvoGuide({
  title,
  description,
  children,
  className,
  imageSize = "default",
}: EvoGuideProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4",
        imageSize === "dashboard" &&
          "grid-cols-[5.1rem_minmax(0,1fr)] sm:grid-cols-[6.3rem_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="aspect-[1273/1236] w-full">
        <img
          src={evoGuideOfficial.url}
          alt="EVO, sua companheira de evolução em inglês"
          width={1273}
          height={1236}
          className="h-full w-full object-contain object-center"
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

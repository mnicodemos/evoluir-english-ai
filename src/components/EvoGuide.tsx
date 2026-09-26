import type { ReactNode } from "react";

import evoGuideOfficial from "@/assets/evo-dashboard-final.jpg.asset.json";
import { cn } from "@/lib/utils";

type EvoGuideProps = {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  imageSize?: "default" | "dashboard" | "diagnosis" | "diagnosisIntro" | "lesson";
  contrast?: "default" | "inverse";
};

export function EvoGuide({
  title,
  description,
  children,
  className,
  imageSize = "default",
  contrast = "default",
}: EvoGuideProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4",
        imageSize === "dashboard" &&
          "grid-cols-[5.1rem_minmax(0,1fr)] sm:grid-cols-[6.3rem_minmax(0,1fr)]",
        (imageSize === "diagnosis" || imageSize === "diagnosisIntro") &&
          "grid-cols-1 justify-items-center gap-4 text-center sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-6 sm:text-left",
        imageSize === "diagnosisIntro" && "sm:grid-cols-[minmax(0,1fr)_7rem]",
        imageSize === "lesson" &&
          "grid-cols-[5.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5",
        className,
      )}
    >
      <div
        className={cn(
          "aspect-[1273/1236] w-full",
          imageSize === "diagnosis" && "w-28 sm:order-2 sm:w-full",
          imageSize === "diagnosisIntro" && "w-24 sm:order-2 sm:w-full",
        )}
      >
        <img
          src={evoGuideOfficial.url}
          alt="EVO, sua companheira de evolução em inglês"
          width={1273}
          height={1236}
          className="h-full w-full object-contain object-center"
        />
      </div>
      <div
        className={cn(
          "min-w-0",
          (imageSize === "diagnosis" || imageSize === "diagnosisIntro") && "sm:order-1",
        )}
      >
        <p
          className={cn(
            "text-xs font-semibold uppercase",
            contrast === "inverse" ? "text-primary-foreground/75" : "text-primary",
          )}
        >
          EVO
        </p>
        <h2
          className={cn(
            "mt-1 text-base font-semibold sm:text-lg",
            contrast === "inverse" ? "text-primary-foreground" : "text-card-foreground",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-1 text-sm",
              contrast === "inverse" ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}

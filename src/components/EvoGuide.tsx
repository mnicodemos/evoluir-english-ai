import type { ReactNode } from "react";

import evoBannerWide from "@/assets/evo-ai-teacher-history-lessons.jpg.asset.json";
import evoGuideOfficial from "@/assets/evo-dashboard-final.jpg.asset.json";
import { cn } from "@/lib/utils";

type EvoGuideProps = {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  imageSize?: "default" | "dashboard" | "diagnosis" | "diagnosisIntro" | "lesson";
  /** Opt-in image variant: "wide" uses the complete horizontal EVO image. */
  image?: "official" | "wide";
  contrast?: "default" | "inverse";
};

export function EvoGuide({
  title,
  description,
  children,
  className,
  imageSize = "default",
  image = "official",
  contrast = "default",
}: EvoGuideProps) {
  const isWide = image === "wide";
  const imageSrc = isWide ? evoBannerWide : evoGuideOfficial;
  const imageWidth = isWide ? 1600 : 1536;
  const imageHeight = isWide ? 400 : 1024;
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4",
        imageSize === "dashboard" &&
          "grid-cols-[5.1rem_minmax(0,1fr)] items-center sm:grid-cols-[6.3rem_minmax(0,1fr)]",
        (imageSize === "diagnosis" || imageSize === "diagnosisIntro") &&
          "grid-cols-1 items-center justify-items-center gap-4 text-center sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-6 sm:text-left",
        imageSize === "diagnosisIntro" && "sm:grid-cols-[minmax(0,1fr)_7rem]",
        imageSize === "lesson" &&
          "grid-cols-[5.5rem_minmax(0,1fr)] items-stretch gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5",
        isWide &&
          imageSize === "lesson" &&
          "grid-cols-[10.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[19rem_minmax(0,1fr)] sm:gap-6",
        className,
      )}
    >
      <div
        className={cn(
          "aspect-[1536/1024] w-full",
          imageSize === "diagnosis" && "w-28 sm:order-2 sm:w-full",
          imageSize === "diagnosisIntro" && "w-24 sm:order-2 sm:w-full",
          imageSize === "lesson" && "h-full",
          isWide && "aspect-[1600/400]",
        )}
      >
        <img
          src={imageSrc.url}
          alt="EVO, sua companheira de evolução em inglês"
          width={imageWidth}
          height={imageHeight}
          className={cn(
            "h-full w-full object-contain object-center",
            imageSize === "lesson" && "object-cover",
            isWide && imageSize === "lesson" && "object-contain object-center",
          )}
        />
      </div>
      <div
        className={cn(
          "min-w-0",
          (imageSize === "diagnosis" || imageSize === "diagnosisIntro") && "sm:order-1",
          imageSize === "lesson" && "self-center",
        )}
      >
        <p
          className={cn(
            "text-xs font-semibold uppercase",
            contrast === "inverse" ? "text-white/80" : "text-primary",
          )}
        >
          EVO
        </p>
        <h2
          className={cn(
            "mt-1 text-base font-semibold sm:text-lg",
            contrast === "inverse" ? "text-white" : "text-card-foreground",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-1 text-sm",
              contrast === "inverse" ? "text-white/80" : "text-muted-foreground",
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

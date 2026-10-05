import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  useWeatherCondition,
  weatherIcons,
  type WeatherCondition,
} from "@/hooks/useWeatherCondition";
import { graphiteIconButtonClass } from "@/lib/surfaces";

const weatherLabels: Record<WeatherCondition, string> = {
  sunny: "Sunny",
  "partly-cloudy": "Partly cloudy",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  snow: "Snow",
  night: "Clear night",
};

/** Compact weather icon for the mobile dashboard header; tap refreshes and shows the weather. */
export function WeatherButton({ translate }: { translate: (label: string) => string }) {
  const { condition, refresh } = useWeatherCondition();
  const Icon = weatherIcons[condition];
  const label = translate(weatherLabels[condition]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`${translate("Weather")}: ${label}`}
      title={label}
      onClick={() => {
        refresh();
        toast(`${translate("Weather")}: ${label}`);
      }}
      className={`relative size-8 shrink-0 rounded-full ${graphiteIconButtonClass}`}
    >
      <Icon className="size-[1.15rem]" aria-hidden="true" />
    </Button>
  );
}

import { MapPin, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useWeatherCondition,
  weatherIcons,
  type WeatherCondition,
} from "@/hooks/useWeatherCondition";
import { graphiteIconButtonClass, graphitePanelClass } from "@/lib/surfaces";
import { useUiLang } from "@/lib/uiLang";

const weatherLabels: Record<WeatherCondition, { en: string; pt: string }> = {
  sunny: { en: "Sunny", pt: "Ensolarado" },
  "partly-cloudy": { en: "Partly cloudy", pt: "Parcialmente nublado" },
  cloudy: { en: "Cloudy", pt: "Nublado" },
  rain: { en: "Rain", pt: "Chuva" },
  storm: { en: "Storm", pt: "Tempestade" },
  snow: { en: "Snow", pt: "Neve" },
  night: { en: "Clear night", pt: "Noite limpa" },
};

/**
 * Weather icon for the mobile dashboard header. The icon follows the live weather
 * (Open-Meteo, from the device location); tapping opens a graphite panel with the
 * condition, where it comes from and a refresh button.
 */
// `translate` is accepted for compatibility with the existing call site; the
// language comes from the app setting.
export function WeatherButton(_props: { translate?: (label: string) => string }) {
  const { lang } = useUiLang();
  const { condition, isLive, refresh } = useWeatherCondition();
  const Icon = weatherIcons[condition];
  const L = (en: string, pt: string) => (lang === "pt" ? pt : en);
  const label = weatherLabels[condition][lang];

  return (
    <Popover onOpenChange={(open) => open && refresh()}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${L("Weather", "Clima")}: ${label}`}
          className={`relative size-8 shrink-0 rounded-full ${graphiteIconButtonClass}`}
        >
          <Icon className="size-[1.15rem]" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={`dashboard-shell dark w-[min(16rem,calc(100vw-1.5rem))] p-3 ${graphitePanelClass}`}
      >
        <p className="font-display text-sm font-semibold">{L("Weather", "Clima")}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold">{label}</p>
            <p className="flex items-center gap-1 text-xs text-slate-300">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              {isLive
                ? L("Live, for your location", "Ao vivo, para sua localização")
                : L("Estimated by time of day", "Estimado pela hora do dia")}
            </p>
          </div>
        </div>
        {!isLive && (
          <p className="mt-3 text-xs text-slate-300">
            {L(
              "Allow location access in your browser to see the real weather.",
              "Permita o acesso à localização no navegador para ver o clima real.",
            )}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={refresh}
          className="mt-3 min-h-11 w-full justify-center gap-2 rounded-lg bg-white/10 text-slate-100 hover:bg-white/15"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {L("Update", "Atualizar")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

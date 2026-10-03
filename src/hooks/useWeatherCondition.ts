import { Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type WeatherCondition =
  "sunny" | "partly-cloudy" | "cloudy" | "rain" | "storm" | "snow" | "night";

export function weatherConditionFromCode(code: number, isDay: boolean): WeatherCondition {
  if (!isDay) return "night";
  if (code === 0) return "sunny";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3 || code === 45 || code === 48) return "cloudy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  return "partly-cloudy";
}

export function fallbackWeatherCondition(date: Date): WeatherCondition {
  return date.getHours() < 6 || date.getHours() >= 18 ? "night" : "sunny";
}

export const weatherIcons = {
  sunny: Sun,
  "partly-cloudy": CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
  night: Moon,
} as const;

// Client-only visual enhancement: uses permitted geolocation and Open-Meteo;
// the deterministic sun/moon icon remains the no-location fallback.
export function useWeatherCondition() {
  const [now, setNow] = useState<Date | null>(null);
  const [condition, setCondition] = useState<WeatherCondition | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const refresh = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const query = new URLSearchParams({
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          current: "weather_code,is_day",
          timezone: "auto",
        });
        void fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`)
          .then((response) => {
            if (!response.ok) throw new Error("Weather unavailable");
            return response.json() as Promise<{
              current?: { weather_code?: number; is_day?: number };
            }>;
          })
          .then(({ current }) => {
            if (typeof current?.weather_code !== "number") return;
            setCondition(weatherConditionFromCode(current.weather_code, current.is_day !== 0));
          })
          .catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeCondition: WeatherCondition =
    condition ?? (now ? fallbackWeatherCondition(now) : "sunny");

  return { condition: activeCondition, refresh };
}

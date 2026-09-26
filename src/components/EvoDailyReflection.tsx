import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Hand,
  Moon,
  Share2,
  Sun,
  TreePine,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDailyReflection, getGreeting, getGreetingTone } from "@/lib/dailyReflection";
import { uiPt } from "@/lib/uiDictionary";
import { useUiLang } from "@/lib/uiLang";

type EvoDailyReflectionProps = {
  userId: string;
  name: string;
  placement?: "desktop" | "mobile-card" | "dashboard-header";
};

type WeatherCondition = "sunny" | "partly-cloudy" | "cloudy" | "rain" | "storm" | "snow" | "night";

function weatherConditionFromCode(code: number, isDay: boolean): WeatherCondition {
  if (!isDay) return "night";
  if (code === 0) return "sunny";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3 || code === 45 || code === 48) return "cloudy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  return "partly-cloudy";
}

const weatherIcons = {
  sunny: Sun,
  "partly-cloudy": CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
  night: Moon,
} as const;

export function EvoDailyReflection({
  userId,
  name,
  placement = "desktop",
}: EvoDailyReflectionProps) {
  const { lang, setLang } = useUiLang();
  const navigate = useNavigate();
  const t = (label: string) => (lang === "pt" ? (uiPt[label] ?? label) : label);
  const [now, setNow] = useState<Date | null>(null);
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (placement !== "dashboard-header" || typeof navigator === "undefined" || !navigator.geolocation) return;

    const controller = new AbortController();
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const query = new URLSearchParams({
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          current: "weather_code,is_day",
          timezone: "auto",
        });
        void fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`, {
          signal: controller.signal,
        })
          .then((response) => {
            if (!response.ok) throw new Error("Weather unavailable");
            return response.json() as Promise<{ current?: { weather_code?: number; is_day?: number } }>;
          })
          .then(({ current }) => {
            if (typeof current?.weather_code !== "number") return;
            setWeatherCondition(weatherConditionFromCode(current.weather_code, current.is_day !== 0));
          })
          .catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30 * 60 * 1000 },
    );

    return () => controller.abort();
  }, [placement]);

  const reflection = getDailyReflection(userId, now ?? new Date(0));
  const greeting = now ? t(getGreeting(now.getHours())) : t("Hello");
  const greetingTone = now ? getGreetingTone(now.getHours()) : "afternoon";
  const treeToneClass = {
    morning: "text-greeting-morning",
    afternoon: "text-greeting-afternoon",
    evening: "text-greeting-evening",
  }[greetingTone];
  const displayName = name.trim().split(/\s+/)[0];
  const copy = lang === "pt" ? "pt" : "en";
  const fallbackCondition: WeatherCondition = now && (now.getHours() < 6 || now.getHours() >= 18) ? "night" : "sunny";
  const activeWeatherCondition = weatherCondition ?? fallbackCondition;
  const WeatherIcon = weatherIcons[activeWeatherCondition];

  async function shareReflection() {
    const text = `“${reflection.thought[copy]}” — ${reflection.reflection[copy]}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("EVO Daily Reflection"), text });
      } catch {
        // user dismissed the native share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("Reflection copied to clipboard"));
    } catch {
      // clipboard unavailable
    }
  }


  if (placement === "dashboard-header") {
    return (
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.68fr)] lg:items-center">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold text-foreground 2xl:text-3xl">
            <span className="truncate">
              {greeting}, {displayName}!
            </span>
             <Hand className="size-6 shrink-0 fill-warning/25 text-warning" strokeWidth={2.2} aria-hidden="true" />
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {t("Great to have you back. Let's keep building your fluency.")}
          </p>
        </div>
        <aside className="dashboard-panel flex min-w-0 items-center gap-3 rounded-lg px-3 py-2">
            <WeatherIcon
              key={activeWeatherCondition}
              className="weather-icon-change size-[1.65rem] shrink-0 text-warning"
              strokeWidth={2.4}
              aria-hidden="true"
            />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-xs text-muted-foreground">
              “{reflection.thought[copy]}”
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
              {reflection.reflection[copy]}
            </p>
          </div>
          <TooltipProvider delayDuration={200}>
          <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={shareReflection}
                  aria-label={t("Share reflection")}
                  className="-m-1 rounded-md p-1 transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                >
                  <Share2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="border border-border bg-secondary text-secondary-foreground">
                {t("Share reflection")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/study-plan" })}
                  aria-label={t("Go to study plan")}
                  className="-m-1 rounded-md p-1 transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                >
                  <Target className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="border border-border bg-secondary text-secondary-foreground">
                {t("Go to study plan")}
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("More options")}
                  className="-m-1 rounded-md p-1 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent active:scale-95"
                >
                  <MoreVertical className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setLang(lang === "en" ? "pt" : "en")}>
                  {t("Change language")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </TooltipProvider>
        </aside>
      </div>
    );
  }

  return (
    <aside
      className={
        placement === "mobile-card"
          ? "card-soft flex min-w-0 items-start gap-4 p-4 lg:hidden"
          : "hidden min-w-0 items-start gap-4 border-l border-border pl-6 lg:flex"
      }
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
        <TreePine className={`size-5 ${treeToneClass}`} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-card-foreground">
          {`${greeting}${displayName ? `, ${displayName}` : ""}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">“{reflection.thought[copy]}”</p>
        <p className={"mt-3 text-xs font-semibold uppercase text-muted-foreground"}>
          {t("Daily reflection")}
        </p>
        <p className={"mt-1 text-sm text-card-foreground"}>{reflection.reflection[copy]}</p>
      </div>
    </aside>
  );
}

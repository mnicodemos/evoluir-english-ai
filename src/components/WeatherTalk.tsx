import { Link } from "@tanstack/react-router";
import {
  CloudMoon,
  CloudSun,
  Loader2,
  LocateFixed,
  MessageCircleMore,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWeatherCondition, weatherIcons } from "@/hooks/useWeatherCondition";
import { speakEnglish } from "@/lib/speech";
import { graphiteIconButtonClass, graphitePanelClass } from "@/lib/surfaces";
import { WEATHER_TALK } from "@/lib/weatherTalk";

/**
 * Today's weather as a small English practice: hear a sentence, learn three
 * words and talk about it with EVO. Location is asked only on tap.
 */
export function WeatherTalk({
  translate,
  placement,
}: {
  translate: (label: string) => string;
  placement: "desktop" | "mobile";
}) {
  const { condition, isLive: live, refresh: requestLocation } = useWeatherCondition();
  const locating = false;
  const [speaking, setSpeaking] = useState(false);
  const talk = WEATHER_TALK[condition];
  const Icon = weatherIcons[condition];
  // The button never shows a bare sun or moon, the usual light/dark theme
  // symbol: clear skies get a cloud, and a small speech bubble says it is an
  // English practice (user request: it was mistaken for a theme switch).
  const TriggerIcon = condition === "sunny" ? CloudSun : condition === "night" ? CloudMoon : Icon;

  async function hear(text: string) {
    setSpeaking(true);
    try {
      await speakEnglish(text, { cache: "persistent" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audio is unavailable right now.");
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {placement === "desktop" ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={translate("Weather talk")}
            title={translate("Weather talk")}
            className="h-7 shrink-0 gap-1.5 rounded-full border border-border px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <TriggerIcon className="size-4" aria-hidden="true" />
            {translate("Weather talk")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={translate("Weather talk")}
            title={translate("Weather talk")}
            className={`relative size-8 shrink-0 rounded-full ${graphiteIconButtonClass}`}
          >
            <TriggerIcon className="size-[1.15rem]" aria-hidden="true" />
            <MessageCircleMore
              className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-background text-brand-green"
              aria-hidden="true"
            />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={placement === "mobile" ? "end" : "start"}
        sideOffset={8}
        className={`dashboard-shell dark w-[min(20rem,calc(100vw-1.5rem))] space-y-3 p-4 ${graphitePanelClass}`}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-green/15 text-brand-green">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {translate("Weather talk")}
            </p>
            <p className="text-sm font-semibold">{talk.label}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void hear(talk.sentence)}
          disabled={speaking}
          className="flex w-full items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left text-sm transition-colors hover:bg-white/10"
        >
          <Volume2 className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden="true" />
          <span>{talk.sentence}</span>
        </button>

        <ul className="space-y-1">
          {talk.words.map(([word, meaning]) => (
            <li key={word}>
              <button
                type="button"
                onClick={() => void hear(word)}
                disabled={speaking}
                className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-white/10"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Volume2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {word}
                </span>
                <span className="text-xs text-muted-foreground">{meaning}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="text-sm text-muted-foreground">{talk.question}</p>

        <Button asChild size="sm" className="w-full">
          <Link to="/coach" search={{ weather: condition }}>
            <MessageCircleMore className="size-4" /> {translate("Talk about the weather")}
          </Link>
        </Button>

        {!live && (
          <div className="border-t border-white/10 pt-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-2 px-1.5 py-1 text-xs text-muted-foreground"
              disabled={locating}
              onClick={requestLocation}
            >
              {locating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LocateFixed className="size-3.5" />
              )}
              {translate("Use the weather where I am")}
            </Button>
            <p className="px-1.5 text-[11px] leading-snug text-muted-foreground">
              {translate("Only to show today's weather. Your location is not saved.")}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

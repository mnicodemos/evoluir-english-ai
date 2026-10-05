import { Link } from "@tanstack/react-router";
import { Loader2, LocateFixed, MessageCircleMore, Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWeatherCondition, weatherIcons } from "@/hooks/useWeatherCondition";
import { speakEnglish } from "@/lib/speech";
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
  const { condition, live, locating, requestLocation } = useWeatherCondition();
  const [speaking, setSpeaking] = useState(false);
  const talk = WEATHER_TALK[condition];
  const Icon = weatherIcons[condition];

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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={translate("Weather talk")}
          title={translate("Weather talk")}
          className={
            placement === "mobile"
              ? "size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              : "size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          }
        >
          <Icon className={placement === "mobile" ? "size-[1.15rem]" : "size-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={placement === "mobile" ? "end" : "start"}
        className="dashboard-shell dark w-80 space-y-3 p-4"
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
          className="flex w-full items-start gap-2 rounded-lg border border-border bg-secondary/40 p-2.5 text-left text-sm transition-colors hover:bg-accent/50"
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
                className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent/50"
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
          <div className="border-t border-border pt-2.5">
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

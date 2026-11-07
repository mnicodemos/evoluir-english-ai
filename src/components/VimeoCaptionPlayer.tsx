import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cleanVimeoPlayerUrl } from "@/lib/lessonVideoDisplay";

type CaptionTrack = { language: "en" | "pt"; content: string };
type Cue = { start: number; end: number; text: string };

function parseTimestamp(value: string): number {
  const parts = value.trim().replace(",", ".").split(":");
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  return Number.NaN;
}

function parseVtt(content: string): Cue[] {
  const normalized = content.replace(/\r\n?/g, "\n");
  return normalized
    .replace(/^\uFEFF?WEBVTT[^\n]*\n/i, "")
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block.trim().split(/\n/);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) return [];
      const timing = lines[timingIndex];
      const validTiming = /(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/.test(timing);
      if (!validTiming) return [];
      const [start, end] = timing.split("-->").map((part) => part.trim().split(/\s+/)[0]);
      const cueText = lines
        .slice(timingIndex + 1)
        .join(" ")
        .replace(/<[^>]*>/g, "")
        .trim();
      const from = parseTimestamp(start);
      const to = parseTimestamp(end);
      return cueText && Number.isFinite(from) && Number.isFinite(to) && to > from
        ? [{ start: from, end: to, text: cueText }]
        : [];
    });
}

export function VimeoCaptionPlayer({
  url,
  title,
  captions,
}: {
  url: string;
  title: string;
  captions: CaptionTrack[];
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const playerId = `evoluir-caption-${useId().replace(/:/g, "")}`;
  const [seconds, setSeconds] = useState(0);
  const [enabled, setEnabled] = useState(captions.length > 0);
  const [language, setLanguage] = useState<"en" | "pt">(
    captions.some((track) => track.language === "pt") ? "pt" : "en",
  );
  const [size, setSize] = useState(75);

  useEffect(() => {
    if (captions.length > 0) {
      setEnabled(true);
      if (!captions.some((item) => item.language === language)) {
        setLanguage(captions.some((item) => item.language === "pt") ? "pt" : "en");
      }
    }
  }, [captions, language]);

  const track = captions.find((item) => item.language === language);
  const cues = useMemo(() => (track ? parseVtt(track.content) : []), [track]);
  const activeCue = cues.find((cue) => seconds >= cue.start && seconds < cue.end);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.source !== frameRef.current?.contentWindow ||
        event.origin !== "https://player.vimeo.com"
      ) {
        return;
      }
      let payload: { event?: string; data?: { seconds?: number } };
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.event === "timeupdate" && typeof payload.data?.seconds === "number") {
        setSeconds(payload.data.seconds);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function subscribeToTimeUpdates() {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ method: "addEventListener", value: "timeupdate" }),
      "https://player.vimeo.com",
    );
  }

  const embed = useMemo(() => {
    const clean = cleanVimeoPlayerUrl(url);
    const target = new URL(clean);
    target.searchParams.set("api", "1");
    target.searchParams.set("player_id", playerId);
    return target.toString();
  }, [url, playerId]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <iframe
        ref={frameRef}
        className="absolute inset-0 h-full w-full"
        src={embed}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={subscribeToTimeUpdates}
      />
      {enabled && activeCue ? (
        <div
          aria-live="off"
          className="pointer-events-none absolute inset-x-3 bottom-14 z-10 mx-auto w-fit max-w-[92%] rounded-md bg-black/85 px-3 py-2 text-center font-semibold leading-snug text-white shadow-lg"
          style={{ fontSize: `${size}%` }}
        >
          {activeCue.text}
        </div>
      ) : null}
      {captions.length > 0 ? (
        <div className="absolute bottom-2 right-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-2 rounded-md bg-black/85 p-2 text-xs text-white shadow-lg">
          <button
            type="button"
            aria-pressed={enabled}
            onClick={() => setEnabled((value) => !value)}
            className="rounded border border-white/40 px-2 py-1"
          >
            {enabled ? "Legendas: ON" : "Legendas: OFF"}
          </button>
          {enabled && track ? (
            <>
              {captions.length > 1 ? (
                <select
                  aria-label="Idioma da legenda"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as "en" | "pt")}
                  className="rounded bg-neutral-800 px-2 py-1"
                >
                  {captions.map((item) => (
                    <option key={item.language} value={item.language}>
                      {item.language === "pt" ? "Português" : "English"}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="flex items-center gap-1.5">
                <span>Tamanho {size}%</span>
                <input
                  aria-label="Tamanho das legendas"
                  type="range"
                  min={50}
                  max={150}
                  step={5}
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                  className="w-20 accent-white"
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Download, Loader2, Music2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MUSIC_SIGN_IN_MESSAGE, musicErrorMessage, musicRequestHeaders } from "@/lib/musicApi";
import { useUiLang } from "@/lib/uiLang";

type GeneratedSong = {
  id: string;
  topic: string;
  genre: (typeof GENRES)[number]["value"];
  goal: (typeof GOALS)[number]["value"];
  lyrics: string;
  audioUrl: string;
  downloadUrl: string;
  mimeType: string;
};

type MusicCreateResponse = (GeneratedSong & { message?: string }) | null;

const GENRES = [
  { value: "pop", label: "Pop" },
  { value: "acoustic", label: "Acoustic" },
  { value: "indie", label: "Indie" },
  { value: "R&B", label: "R&B / Soul" },
  { value: "rock", label: "Rock" },
  { value: "reggae", label: "Reggae" },
  { value: "lofi", label: "Lo-fi" },
] as const;

const GOALS = [
  { value: "everyday vocabulary", label: "Everyday vocabulary" },
  { value: "pronunciation and rhythm", label: "Pronunciation & rhythm" },
  { value: "phrasal verbs and expressions", label: "Phrasal verbs & expressions" },
  { value: "grammar in context", label: "Grammar in context" },
] as const;

function audioFileExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("l16")) return "pcm";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  return "audio";
}

function safeSongFilename(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "evoluir-song";
}

type Props = {
  level: string;
  levelLabel: string;
};

/** Music creation lives inside Listening Lab; the server resolves the authoritative profile level. */
export function MusicLabSection({ level, levelLabel }: Props) {
  const { lang } = useUiLang();
  const portuguese = lang === "pt";
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState<(typeof GENRES)[number]["value"]>("pop");
  const [goal, setGoal] = useState<(typeof GOALS)[number]["value"]>("everyday vocabulary");
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [checkingCooldown, setCheckingCooldown] = useState(true);
  const [songs, setSongs] = useState<GeneratedSong[]>([]);
  const [activeFocus, setActiveFocus] = useState<string>("all");
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function loadCooldown() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const headers = musicRequestHeaders(sessionData.session?.access_token);
        if (!headers) return;
        const response = await fetch("/api/music", { headers, cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as { availableAt?: string | null };
        if (active) setCooldownUntil(result.availableAt ?? null);
      } catch {
        // The server remains authoritative and will reject attempts during cooldown.
      } finally {
        if (active) setCheckingCooldown(false);
      }
    }
    void loadCooldown();
    return () => {
      active = false;
    };
  }, []);

  const cooldownActive = Boolean(cooldownUntil && new Date(cooldownUntil).getTime() > Date.now());
  const cooldownMessage = cooldownActive
    ? `You can create another song after ${new Date(cooldownUntil!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
    : null;

  async function createSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers = musicRequestHeaders(sessionData.session?.access_token);
      if (!headers) throw new Error(MUSIC_SIGN_IN_MESSAGE);
      const response = await fetch("/api/music", {
        method: "POST",
        headers,
        body: JSON.stringify({ topic: topic.trim(), genre, goal }),
      });
      const result = (await response.json().catch(() => null)) as MusicCreateResponse;
      if (!response.ok) {
        throw new Error(musicErrorMessage(response.status, result?.message));
      }
      if (!result?.id || !result.audioUrl || !result.downloadUrl || !result.lyrics) {
        throw new Error("The music service returned an incomplete song. Please try again.");
      }

      const newSong: GeneratedSong = {
        id: result.id,
        topic: result.topic,
        genre: result.genre,
        goal: result.goal,
        lyrics: result.lyrics,
        audioUrl: result.audioUrl,
        downloadUrl: result.downloadUrl,
        mimeType: result.mimeType || "audio/mpeg",
      };
      setSongs((current) => [newSong, ...current]);
      setCooldownUntil(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      setActiveFocus(goal);
      setExpandedSongs((current) => new Set(current).add(newSong.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create your song.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const focusLabel = (value: string) => GOALS.find((item) => item.value === value)?.label ?? value;
  const focusTabs = [
    { value: "all", label: "All", count: songs.length },
    ...GOALS.map((item) => ({
      value: item.value,
      label: item.label,
      count: songs.filter((song) => song.goal === item.value).length,
    })).filter((item) => item.count > 0),
  ];
  const visibleSongs =
    activeFocus === "all" ? songs : songs.filter((song) => song.goal === activeFocus);

  function toggleExpanded(id: string) {
    setExpandedSongs((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="card-soft h-full space-y-5 p-5 sm:p-6" aria-labelledby="music-lab-title">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green">
          <Music2 className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-green">
            Listening Experience • Music Lab
          </p>
          <h2 id="music-lab-title" className="mt-1 font-display text-xl font-semibold">
            Learn English through your own song
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            EVO adapts the lyrics and language to your current level:{" "}
            <strong className="text-foreground">{levelLabel || level}</strong>. You choose the topic
            and sound, not the CEFR level.
          </p>
        </div>
      </div>

      <div
        className="rounded-lg border border-brand-green/25 bg-brand-green/5 p-3 text-sm"
        role="note"
      >
        <p className="font-semibold">Your song is available for this session only.</p>
        <p className="mt-1 text-muted-foreground">
          Play it now and use Download to save the audio to your device before leaving or refreshing
          this page. Evoluir+ does not keep a permanent copy of the audio.
        </p>
        {cooldownMessage && (
          <p className="mt-2 font-medium" role="status">
            {cooldownMessage}
          </p>
        )}
        {checkingCooldown && (
          <p className="mt-2 text-muted-foreground" role="status">
            Checking song availability…
          </p>
        )}
      </div>

      <form onSubmit={createSong} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm md:col-span-2">
          <span className="font-medium">What should your song be about?</span>
          <input
            value={topic}
            disabled={checkingCooldown || cooldownActive || loading}
            onChange={(event) => setTopic(event.target.value.slice(0, 80))}
            maxLength={80}
            required
            placeholder="e.g. travelling alone, new beginnings, everyday life"
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="block text-xs text-muted-foreground">
            Up to 80 characters. Keep it original and specific.
          </span>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Music style</span>
          <select
            value={genre}
            disabled={checkingCooldown || cooldownActive || loading}
            onChange={(event) => setGenre(event.target.value as typeof genre)}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {GENRES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Learning focus</span>
          <select
            disabled={checkingCooldown || cooldownActive || loading}
            value={goal}
            onChange={(event) => setGoal(event.target.value as typeof goal)}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {GOALS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button
            type="submit"
            disabled={checkingCooldown || cooldownActive || loading || !topic.trim() || !level}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            {loading ? "Creating your song..." : "Create my song"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Creates an original 30-second English song with vocals and instrumental music.
          </p>
        </div>
      </form>

      {songs.length > 0 && (
        <section className="space-y-4" aria-label="Generated songs">
          <div className="space-y-2">
            <h3 className="font-display text-base font-semibold">My songs</h3>
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              role="tablist"
              aria-label="Filter songs by Learning focus"
            >
              {focusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={activeFocus === tab.value}
                  onClick={() => setActiveFocus(tab.value)}
                  className={`min-h-10 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors ${
                    activeFocus === tab.value
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label} <span className="ml-1 text-xs opacity-75">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {visibleSongs.map((song) => {
              const expanded = expandedSongs.has(song.id);
              const safeFilename = safeSongFilename(song.topic);
              const fileExtension = audioFileExtension(song.mimeType);
              return (
                <article
                  key={song.id}
                  className="overflow-hidden rounded-xl border border-brand-green/25"
                >
                  <div className="flex items-center gap-3 p-3 sm:p-4">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-green/10 text-brand-green">
                      <Music2 className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold">{song.topic || "Your new song"}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {focusLabel(song.goal)} <span aria-hidden="true">·</span>{" "}
                        {GENRES.find((item) => item.value === song.genre)?.label ?? song.genre}
                      </p>
                    </div>
                    <a
                      href={song.downloadUrl}
                      download={`evoluir-${safeFilename}.${fileExtension}`}
                      aria-label={`Download song: ${song.topic}`}
                      className="grid size-9 shrink-0 place-items-center rounded-md text-brand-green hover:bg-brand-green/10"
                    >
                      <Download className="size-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(song.id)}
                      aria-expanded={expanded}
                      aria-label={expanded ? "Minimize song details" : "Expand song details"}
                      className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-secondary"
                    >
                      {expanded ? (
                        <ChevronUp className="size-5" />
                      ) : (
                        <ChevronDown className="size-5" />
                      )}
                    </button>
                  </div>
                  {expanded && (
                    <div className="space-y-4 border-t border-border/70 p-3 sm:p-4">
                      <p className="text-xs text-muted-foreground">
                        Session-only audio — download it now to keep a copy.
                      </p>
                      <audio
                        controls
                        preload="metadata"
                        src={song.audioUrl}
                        className="w-full"
                        aria-label={`Play song: ${song.topic}`}
                      >
                        Your browser does not support audio playback.
                      </audio>
                      <div>
                        <h5 className="mb-2 text-sm font-semibold">Lyrics</h5>
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">
                          {song.lyrics}
                        </pre>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {visibleSongs.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No songs for this Learning focus yet.
              </p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

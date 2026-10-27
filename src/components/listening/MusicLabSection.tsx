import { useState, type FormEvent } from "react";
import { Download, Loader2, Music2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type GeneratedSong = {
  lyrics: string;
  audioBase64: string;
  mimeType: string;
};

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

type Props = {
  level: string;
  levelLabel: string;
};

/** Music creation lives inside Listening Lab; the server resolves the authoritative profile level. */
export function MusicLabSection({ level, levelLabel }: Props) {
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState<(typeof GENRES)[number]["value"]>("pop");
  const [goal, setGoal] = useState<(typeof GOALS)[number]["value"]>("everyday vocabulary");
  const [loading, setLoading] = useState(false);
  const [song, setSong] = useState<GeneratedSong | null>(null);

  async function createSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSong(null);
    try {
      const response = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), genre, goal }),
      });
      const result = (await response.json().catch(() => null)) as
        | (GeneratedSong & { message?: string })
        | null;
      if (!response.ok) throw new Error(result?.message ?? "Music generation is unavailable right now.");
      if (!result?.audioBase64 || !result.lyrics) {
        throw new Error("The music service returned an incomplete song. Please try again.");
      }
      setSong({
        lyrics: result.lyrics,
        audioBase64: result.audioBase64,
        mimeType: result.mimeType || "audio/mpeg",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create your song.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const audioUrl = song ? `data:${song.mimeType};base64,${song.audioBase64}` : undefined;
  const safeTopic = topic.trim();

  return (
    <section className="card-soft space-y-5 p-5 sm:p-6" aria-labelledby="music-lab-title">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green">
          <Music2 className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">Listening Lab · Music Lab</p>
          <h2 id="music-lab-title" className="mt-1 font-display text-xl font-semibold">
            Learn English through your own song
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            EVO adapts the lyrics and language to your current level: <strong className="text-foreground">{levelLabel || level}</strong>. You choose the topic and sound, not the CEFR level.
          </p>
        </div>
      </div>

      <form onSubmit={createSong} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm md:col-span-2">
          <span className="font-medium">What should your song be about?</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value.slice(0, 80))}
            maxLength={80}
            required
            placeholder="e.g. travelling alone, new beginnings, everyday life"
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="block text-xs text-muted-foreground">Up to 80 characters. Keep it original and specific.</span>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Music style</span>
          <select
            value={genre}
            onChange={(event) => setGenre(event.target.value as typeof genre)}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {GENRES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Learning focus</span>
          <select
            value={goal}
            onChange={(event) => setGoal(event.target.value as typeof goal)}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {GOALS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={loading || !topic.trim() || !level}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {loading ? "Creating your song..." : "Create my song"}
          </Button>
          <p className="text-xs text-muted-foreground">Creates an original English song with vocals and instrumental music.</p>
        </div>
      </form>

      {song && audioUrl && (
        <div className="space-y-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{safeTopic || "Your new song"}</h3>
            <a
              href={audioUrl}
              download="evoluir-music-lab.mp3"
              className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-brand-green hover:bg-brand-green/10"
            >
              <Download className="size-4" /> Download song
            </a>
          </div>
          <audio controls preload="metadata" src={audioUrl} className="w-full">
            Your browser does not support audio playback.
          </audio>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Lyrics</h4>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">{song.lyrics}</pre>
          </div>
        </div>
      )}
    </section>
  );
}

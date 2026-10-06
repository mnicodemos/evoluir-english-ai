import { Volume2, WifiOff } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import type { OfflineVocabulary as OfflineVocabularyData } from "@/lib/offlineVocabulary";
import { speakEnglish } from "@/lib/speech";

/**
 * Read-only Vocabulary shown without a connection: the words saved on the
 * device the last time the page was open. Audio uses the sound already saved
 * on the device, or the browser voice; marking words waits for the connection.
 */
export function OfflineVocabulary({
  saved,
  t,
}: {
  saved: OfflineVocabularyData;
  t: (text: string) => string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const speak = async (id: string, text: string) => {
    setPlaying(id);
    try {
      await speakEnglish(text, { cache: "persistent" });
    } catch {
      // No sound available offline for this word: the text is still there.
    } finally {
      setPlaying(null);
    }
  };
  const savedOn = new Date(saved.savedAt).toLocaleDateString();

  return (
    <AppShell mobileOneScreen>
      <h1 className="text-2xl font-bold lg:text-3xl">Vocabulary Builder</h1>
      <div
        role="status"
        className="mt-3 flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm"
      >
        <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
        <p>
          <strong>{t("You are offline.")}</strong> {t("These are the words saved on this device")} (
          {savedOn}). {t("Marking words and checking pronunciation come back with the connection.")}
        </p>
      </div>

      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {saved.words.map((w) => (
          <li key={w.id} className="card-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold">{w.word}</p>
                <p className="text-sm text-muted-foreground">{w.translation}</p>
              </div>
              <button
                type="button"
                onClick={() => void speak(w.id, w.word)}
                disabled={playing === w.id}
                aria-label={`${t("Listen")}: ${w.word}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
              >
                <Volume2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            {w.meaning && <p className="mt-2 text-sm">{w.meaning}</p>}
            {w.pronunciation && (
              <p className="mt-1 text-sm text-muted-foreground">{w.pronunciation}</p>
            )}
            {w.example && (
              <p className="mt-2 rounded-md bg-secondary/60 px-3 py-2 text-sm italic">
                “{w.example}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

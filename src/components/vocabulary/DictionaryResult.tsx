import { Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { highlightWord } from "@/components/vocabulary/highlightWord";
import type { lookupWord } from "@/lib/dictionary.functions";

type DictionaryEntry = Awaited<ReturnType<typeof lookupWord>>;

/** Result of the Vocabulary search (context.reverso.net), shown while a term is typed. */
export function DictionaryResult({
  q,
  searching,
  entry,
  playing,
  onSpeak,
}: {
  q: string;
  searching: boolean;
  entry: DictionaryEntry | undefined;
  playing: boolean;
  onSpeak: (word: string) => void;
}) {
  return (
    <section aria-label="Search results" className="mt-6">
      {searching ? (
        <Skeleton className="h-40 w-full" />
      ) : !entry?.found ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            No dictionary entry found for <span className="font-medium">“{q}”</span>.
          </p>
          <p>Check the spelling and try another English word.</p>
        </div>
      ) : (
        <article className="card-soft p-5">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold">{entry.word}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSpeak(entry.word)}
              aria-label="Listen"
              className={playing ? "bg-success text-success-foreground hover:bg-success/90" : ""}
            >
              <Volume2 className="size-5" />
            </Button>
          </div>

          {(entry.ipaUs || entry.ipaUk) && (
            <p className="mt-1 text-sm text-muted-foreground">
              {entry.ipaUs && <span>US /{entry.ipaUs}/</span>}
              {entry.ipaUs && entry.ipaUk && <span> · </span>}
              {entry.ipaUk && <span>UK /{entry.ipaUk}/</span>}
            </p>
          )}

          {entry.meanings.length > 0 && (
            <ol className="mt-5 grid gap-4">
              {entry.meanings.map((m, i) => (
                <li key={i} className="border-b border-border pb-4 last:border-0">
                  <p className="text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span>{" "}
                    {m.context && (
                      <span className="italic text-muted-foreground">({m.context})</span>
                    )}{" "}
                    {m.definition}
                  </p>

                  {m.translations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.translations.map((t, j) => (
                        <span
                          key={j}
                          className="rounded-md bg-secondary px-2.5 py-1 text-sm font-medium text-secondary-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {m.example && (
                    <div className="mt-3 text-sm">
                      <p className="italic text-foreground">
                        "{highlightWord(m.example.en, entry.word)}"
                      </p>
                      <p className="mt-1 text-muted-foreground">{m.example.pt}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-xs text-muted-foreground underline"
          >
            Source: context.reverso.net
          </a>
        </article>
      )}
    </section>
  );
}

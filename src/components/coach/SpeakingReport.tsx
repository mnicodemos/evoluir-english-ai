import { EvoAvatar } from "@/components/EvoAvatar";
import { Progress } from "@/components/ui/progress";
import type { ConversationReport } from "@/lib/ai-prompts";

/** Scores, summary, suggestions and new words at the end of a speaking session. */
export function SpeakingReport({ report }: { report: ConversationReport }) {
  return (
    <section className="card-soft animate-rise p-6">
      <h2 className="text-lg font-semibold">Speaking report</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {[
          { label: "Fluency", value: report.fluency },
          { label: "Grammar", value: report.grammar },
          { label: "Vocabulary", value: report.vocabulary },
        ].map((score) => (
          <div key={score.label}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{score.label}</span>
              <span className="text-muted-foreground">{score.value}</span>
            </div>
            <Progress value={score.value} className="mt-2 h-2" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3">
        <EvoAvatar decorative className="size-10 sm:size-12" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">EVO</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{report.summary}</p>
        </div>
      </div>
      {report.suggestions.length > 0 && (
        <>
          <h3 className="mt-6 font-semibold">Improvement suggestions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {report.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </>
      )}
      {report.new_words.length > 0 && (
        <>
          <h3 className="mt-6 font-semibold">Words to learn</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.new_words.map((word) => (
              <span
                key={word}
                className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground"
              >
                {word}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

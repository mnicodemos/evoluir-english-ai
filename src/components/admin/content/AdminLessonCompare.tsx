// "Lesson test" tab of the Admin panel: writes one path lesson with the current
// Gemini settings and with the thinking step off, side by side, so quality can
// be judged before the fast mode is turned on for students. Nothing is saved.
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { compareLessonGeneration } from "@/lib/admin.functions";
import { getCurriculum } from "@/lib/curriculum";
import { LEVELS } from "@/lib/level";

type Result = Awaited<ReturnType<typeof compareLessonGeneration>>;
type Side = Result["normal"];

function SideReport({ title, side }: { title: string; side: Side }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-3">
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 text-sm">
        <strong>{(side.ms / 1000).toFixed(1)} s</strong>
        {side.outputTokens !== null && ` · ${side.outputTokens.toLocaleString()} tokens out`}
      </p>
      {side.error ? (
        <p className="mt-2 text-sm text-red-400">{side.error}</p>
      ) : side.check ? (
        <div className="mt-2 text-xs text-muted-foreground">
          <p>
            Strict validation:{" "}
            <span className={side.check.strictValid ? "text-emerald-400" : "text-amber-400"}>
              {side.check.strictValid ? "passed" : "failed"}
            </span>{" "}
            (expected {side.check.expected.flashcards} cards, {side.check.expected.quiz} quiz)
          </p>
          {side.check.salvaged && (
            <p>
              Salvaged item by item: {side.check.salvaged.flashcards} cards,{" "}
              {side.check.salvaged.quiz} quiz
            </p>
          )}
          {side.check.issues.length > 0 && <p>Issues: {side.check.issues.join("; ")}</p>}
        </div>
      ) : null}
      {side.content && (
        <pre className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 text-[11px] leading-snug">
          {side.content}
        </pre>
      )}
    </div>
  );
}

export function AdminLessonCompare() {
  const [level, setLevel] = useState("b1");
  const lessons = useMemo(() => getCurriculum(level), [level]);
  const [key, setKey] = useState(() => getCurriculum("b1")[0]?.key ?? "");
  const compare = useServerFn(compareLessonGeneration);
  const run = useMutation({
    mutationFn: (lessonKey: string) => compare({ data: { key: lessonKey } }),
  });

  return (
    <section className="mt-2 border-t border-border pt-4">
      <h3 className="font-semibold">Lesson generation test (normal vs fast)</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Writes the same lesson twice: with the current settings and without the thinking step.
        Nothing is saved and no student sees it. Each test makes two AI calls.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Level
          <select
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5"
            value={level}
            onChange={(event) => {
              setLevel(event.target.value);
              setKey(getCurriculum(event.target.value)[0]?.key ?? "");
            }}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 text-sm">
          Lesson
          <select
            className="mt-1 block w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          >
            {lessons.map((lesson) => (
              <option key={lesson.key} value={lesson.key}>
                {lesson.unit}.{lesson.position} {lesson.title}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => run.mutate(key)} disabled={!key || run.isPending}>
          {run.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {run.isPending ? "Writing both versions…" : "Compare"}
        </Button>
      </div>

      {run.isError && (
        <p className="mt-3 text-sm text-red-400">
          {run.error instanceof Error ? run.error.message : "The test could not run."}
        </p>
      )}
      {run.data && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <SideReport title="Normal (current)" side={run.data.normal} />
          <SideReport title="Fast (no thinking)" side={run.data.fast} />
        </div>
      )}
    </section>
  );
}

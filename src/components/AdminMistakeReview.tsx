import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useUiLang } from "@/lib/uiLang";
import { getMistakeReviewReport } from "@/lib/admin.functions";

const SOURCE_LABEL = {
  teacher: "AI Teacher",
  writing: "Writing",
  quiz: "Lesson quiz",
} as const;

/**
 * Admin: do corrections stick? Mistakes saved by the AI Teacher and by
 * Writing, how many were reviewed and how many the students got right at
 * the last review.
 */
export function AdminMistakeReview() {
  const { lang } = useUiLang();
  const pt = lang === "pt";
  const load = useServerFn(getMistakeReviewReport);
  const query = useQuery({ queryKey: ["admin", "mistake-review"], queryFn: () => load() });
  if (query.isPending) return null;
  if (query.isError) {
    return (
      <p className="mt-4 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        {pt ? "Não foi possível carregar a revisão dos erros." : "Could not load the mistake review."}
      </p>
    );
  }
  return (
    <section
      className="mt-4 rounded-xl border border-border p-3 sm:p-4"
      aria-label={pt ? "As correções ficam?" : "Do corrections stick?"}
    >
      <p className="text-sm font-semibold">{pt ? "As correções ficam?" : "Do corrections stick?"}</p>
      <p className="text-xs text-muted-foreground">
        {pt ? "Erros salvos em Meus erros, revisados e acertados na última revisão" : "Mistakes saved in My Mistakes, reviewed, and answered correctly in the latest review"}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {query.data.map((row) => (
          <div key={row.source} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{SOURCE_LABEL[row.source]}</p>
            <p className="mt-1 text-2xl font-bold">
              {row.percent === null ? "—" : `${row.percent}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {pt ? `${row.retained} acertados de ${row.reviewed} revisados · ${row.saved} salvos` : `${row.retained} correct out of ${row.reviewed} reviewed · ${row.saved} saved`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

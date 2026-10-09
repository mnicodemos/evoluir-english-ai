import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMistakeReviewReport } from "@/lib/admin.functions";

const SOURCE_LABEL = { teacher: "Professor de IA", writing: "Writing" } as const;

/**
 * Admin: do corrections stick? Mistakes saved by the AI Teacher and by
 * Writing, how many were reviewed and how many the students got right at
 * the last review.
 */
export function AdminMistakeReview() {
  const load = useServerFn(getMistakeReviewReport);
  const query = useQuery({ queryKey: ["admin", "mistake-review"], queryFn: () => load() });
  if (query.isPending) return null;
  if (query.isError) {
    return (
      <p className="mt-4 rounded-xl border border-border p-3 text-sm text-muted-foreground">
        Não foi possível carregar a revisão dos erros.
      </p>
    );
  }
  return (
    <section
      className="mt-4 rounded-xl border border-border p-3 sm:p-4"
      aria-label="As correções ficam?"
    >
      <p className="text-sm font-semibold">As correções ficam?</p>
      <p className="text-xs text-muted-foreground">
        Erros salvos em Meus erros, revisados e acertados na última revisão
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {query.data.map((row) => (
          <div key={row.source} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{SOURCE_LABEL[row.source]}</p>
            <p className="mt-1 text-2xl font-bold">
              {row.percent === null ? "—" : `${row.percent}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.retained} acertados de {row.reviewed} revisados · {row.saved} salvos
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

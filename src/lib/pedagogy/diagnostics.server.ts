/**
 * Minimal internal diagnostic counters for the pedagogical pipeline.
 * Server-only: it uses the privileged client and is never exposed to a route,
 * so no student data reaches the frontend.
 */
export type PedagogicalDiagnostics = {
  unresolvedPedagogicalFailures: number;
  orphanQuizResults: number;
};

export async function readPedagogicalDiagnostics(): Promise<PedagogicalDiagnostics> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [failures, orphans] = await Promise.all([
    supabaseAdmin
      .from("unresolved_pedagogical_failures")
      .select("failure_id", { count: "exact", head: true }),
    supabaseAdmin.from("orphan_quiz_results").select("quiz_result_id", { count: "exact", head: true }),
  ]);

  return {
    unresolvedPedagogicalFailures: failures.count ?? 0,
    orphanQuizResults: orphans.count ?? 0,
  };
}

import { supabase } from "@/integrations/supabase/client";

/**
 * The signed-in user's id from the locally stored session (no network call).
 * Reads of per-student tables filter by it explicitly, so an account whose
 * row-level policies can see other students (an admin) still gets only its
 * own rows — the lesson round, vocabulary batch and progress depend on that.
 */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

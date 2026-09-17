import { supabase } from "@/integrations/supabase/client";

type MutationError = {
  code?: string;
  message: string;
};

type MutationResult = {
  error: MutationError | null;
  status: number;
};

function isUnauthorized(result: MutationResult) {
  const message = result.error?.message.toLowerCase() ?? "";
  return result.status === 401 || (message.includes("jwt") && message.includes("expired"));
}

/** Runs a progress write and retries it once after refreshing an expired session. */
export async function runProgressMutation<T extends MutationResult>(
  operation: () => PromiseLike<T>,
): Promise<T> {
  let result = await operation();
  if (result.error && isUnauthorized(result)) {
    const { error } = await supabase.auth.refreshSession();
    if (!error) result = await operation();
  }
  if (result.error) throw result.error;
  return result;
}

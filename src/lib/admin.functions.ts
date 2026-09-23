// Admin panel backend. Authorization happens server-side only: the signed-in
// user's email comes from the verified token claims, never from the client.
// Reuses the existing auth middleware and the existing profiles table.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAILS = ["mncelo.n@gmail.com"];

function isAdminClaims(claims: Record<string, unknown>): boolean {
  const email = claims["email"];
  if (typeof email !== "string") return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export const isAdminUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    isAdmin: isAdminClaims(context.claims as unknown as Record<string, unknown>),
  }));

export const listRegisteredUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isAdminClaims(context.claims as unknown as Record<string, unknown>)) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error, count } = await supabaseAdmin
      .from("profiles")
      .select("name, email", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    return {
      total: count ?? data.length,
      users: (data ?? []).map((row) => ({ name: row.name, email: row.email ?? "" })),
    };
  });

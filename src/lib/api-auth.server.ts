import { createClient } from "@supabase/supabase-js";

let authClient: ReturnType<typeof createClient> | null = null;

function client() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Authentication is not configured.");
  authClient ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authClient;
}

export async function authenticateApiRequest(request: Request): Promise<string> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const { data, error } = await client().auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return userId;
}

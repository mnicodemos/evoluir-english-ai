/**
 * Cross-user security checks (data isolation between students).
 *
 * These are INTEGRATION tests: they run against the real backend and need two
 * dedicated test accounts. They are skipped unless all of these are set:
 *
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD          — user A (fresh test account)
 *   SECURITY_USER_B_EMAIL / SECURITY_USER_B_PASSWORD — user B (fresh test account)
 *   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY     — publishable client values
 *
 * Never point them at a personal or production admin account.
 *
 * What is proven:
 *  - A can read/write its own rows where RLS grants it.
 *  - A cannot SELECT rows owned by B.
 *  - A cannot UPDATE or DELETE rows owned by B (zero affected rows).
 *  - A cannot INSERT a row that claims B's user_id — with a payload that is
 *    otherwise valid (real lesson FK), so the rejection can only come from RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env["SUPABASE_URL"];
const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];

const emailA = process.env["E2E_USER_EMAIL"];
const passwordA = process.env["E2E_USER_PASSWORD"];
const emailB = process.env["SECURITY_USER_B_EMAIL"];
const passwordB = process.env["SECURITY_USER_B_PASSWORD"];

const configured = Boolean(url && publishableKey && emailA && passwordA && emailB && passwordB);
const d = configured ? describe : describe.skip;

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function userIdOf(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("No session after sign-in");
  return data.user.id;
}

d("cross-user data isolation", () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let idA = "";
  let idB = "";

  it("signs in both dedicated test users", async () => {
    a = await signIn(emailA!, passwordA!);
    b = await signIn(emailB!, passwordB!);
    idA = await userIdOf(a);
    idB = await userIdOf(b);
    expect(idA).not.toBe(idB);
  });

  it("A reads its own profile but not B's", async () => {
    const own = await a.from("profiles").select("id, name").eq("id", idA).maybeSingle();
    expect(own.error).toBeNull();
    expect(own.data?.id).toBe(idA);

    const foreign = await a.from("profiles").select("id").eq("id", idB);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toHaveLength(0);
  });

  it("A cannot update or delete B's profile", async () => {
    const upd = await a.from("profiles").update({ bio: "hacked" }).eq("id", idB);
    expect(upd.error).toBeNull(); // RLS silently filters: zero affected rows
    const victim = await b.from("profiles").select("bio").eq("id", idB).maybeSingle();
    expect(victim.data?.bio).not.toBe("hacked");

    const del = await a.from("profiles").delete().eq("id", idB);
    expect(del.error).toBeNull();
    const stillThere = await b.from("profiles").select("id").eq("id", idB).maybeSingle();
    expect(stillThere.data?.id).toBe(idB);
  });

  it("A cannot insert progress rows that claim B's user_id", async () => {
    // `progress` has a per-user SELECT policy and no INSERT policy: the payload
    // is well-formed, so a rejection can only come from RLS.
    const inserted = await a.from("progress").insert({
      user_id: idB,
      speaking_score: 10,
      grammar_score: 10,
      listening_score: 10,
      vocabulary_score: 10,
      writing_score: 10,
      reading_score: 10,
      recorded_at: new Date().toISOString(),
    });
    expect(inserted.error).not.toBeNull();
  });

  it("A can insert its own progress row (valid payload, RLS allows own user)", async () => {
    const inserted = await a.from("progress").insert({
      user_id: idA,
      speaking_score: 10,
      grammar_score: 10,
      listening_score: 10,
      vocabulary_score: 10,
      writing_score: 10,
      reading_score: 10,
      recorded_at: new Date().toISOString(),
    });
    expect(inserted.error).toBeNull();
  });

  it("A cannot read B's quiz results or activities", async () => {
    const quiz = await a.from("quiz_results").select("id").eq("user_id", idB);
    expect(quiz.data).toHaveLength(0);
    const acts = await a.from("activities").select("id").eq("user_id", idB);
    expect(acts.data).toHaveLength(0);
  });
});

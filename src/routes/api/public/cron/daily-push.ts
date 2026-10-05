import { createFileRoute } from "@tanstack/react-router";

import { isStaleTokenResponse } from "@/lib/pushStaleToken";
import { studyToday } from "@/lib/today";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/** Small per-level fallback when the shared word bank has nothing new. */
const FALLBACK_WORDS: Record<string, { word: string; translation: string; meaning: string }[]> = {
  a1: [
    { word: "breakfast", translation: "café da manhã", meaning: "the first meal of the day" },
    { word: "neighbor", translation: "vizinho", meaning: "a person who lives near you" },
  ],
  a2: [
    {
      word: "borrow",
      translation: "pegar emprestado",
      meaning: "to take something you will give back",
    },
  ],
  b1: [{ word: "improve", translation: "melhorar", meaning: "to make something better" }],
  b2: [{ word: "outcome", translation: "resultado", meaning: "the final result of a process" }],
  c1: [
    {
      word: "nuanced",
      translation: "sutil, com nuances",
      meaning: "showing small but important differences",
    },
  ],
  c2: [{ word: "ubiquitous", translation: "onipresente", meaning: "found everywhere" }],
};

function hashIndex(seed: string, size: number) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return size ? h % size : 0;
}

export const Route = createFileRoute("/api/public/cron/daily-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Caller must present the scheduler key that only the database knows.
        const provided = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const { data: keyRow } = await supabaseAdmin
          .from("push_cron_key")
          .select("key")
          .eq("id", 1)
          .maybeSingle();
        if (!provided || !keyRow?.key || provided !== keyRow.key) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as { kind?: string };
        const kind = body.kind === "reminder" ? "reminder" : "word";

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
        if (!lovableKey || !connectionKey) {
          return Response.json({ error: "Push not configured" }, { status: 500 });
        }
        const { data: tokens, error } = await supabaseAdmin
          .from("push_tokens")
          .select("user_id, token");
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const userIds = [...new Set((tokens ?? []).map((t) => t.user_id))];
        if (userIds.length === 0) return Response.json({ sent: 0 });

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, level, last_activity_date")
          .in("id", userIds);
        // Same study day as credit_study_day (America/Sao_Paulo).
        const today = studyToday();

        const messages = new Map<string, { title: string; body: string; path: string }>();
        for (const p of profiles ?? []) {
          if (kind === "reminder") {
            // last_activity_date is set only when the day's goal is met (credit_study_day).
            if (p.last_activity_date === today) continue;
            messages.set(p.id, {
              title: "Hora de estudar inglês 📚",
              body: "Você ainda não completou sua meta de hoje. Faça uma atividade rápida e mantenha seu Streak!",
              path: "/dashboard",
            });
            continue;
          }
          const level = (p.level ?? "a1").toLowerCase();
          const [{ data: bank }, { data: known }] = await Promise.all([
            supabaseAdmin
              .from("vocabulary")
              .select("id, word, translation, meaning")
              .eq("level", level)
              .limit(500),
            supabaseAdmin.from("user_vocabulary").select("word_id").eq("user_id", p.id),
          ]);
          const knownIds = new Set((known ?? []).map((k) => k.word_id));
          const seen = new Set<string>();
          const fresh = (bank ?? []).filter((w) => {
            const key = w.word.toLowerCase();
            if (knownIds.has(w.id) || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          const pool = fresh.length ? fresh : (FALLBACK_WORDS[level] ?? FALLBACK_WORDS["a1"]!);
          const w = pool[hashIndex(`${p.id}:${today}`, pool.length)]!;
          messages.set(p.id, {
            title: `Palavra do dia: ${w.word}`,
            body: `${w.translation} — ${w.meaning}`.slice(0, 280),
            path: "/vocabulary",
          });
        }

        let sent = 0;
        const stale: string[] = [];
        for (const t of tokens ?? []) {
          const msg = messages.get(t.user_id);
          if (!msg) continue;
          const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": connectionKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification: { title: msg.title, body: msg.body },
                data: { path: msg.path },
              },
            }),
          });
          if (res.ok) sent += 1;
          else {
            const errorBody = await res.text();
            console.error(`daily-push FCM failed [${res.status}]: ${errorBody}`);
            if (isStaleTokenResponse(res.status, errorBody)) stale.push(t.token);
          }
        }
        if (stale.length) await supabaseAdmin.from("push_tokens").delete().in("token", stale);

        return Response.json({ kind, sent, removed: stale.length });
      },
    },
  },
});

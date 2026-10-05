import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

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

function saoPauloToday() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

function hashIndex(seed: string, size: number) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return size ? h % size : 0;
}

export const Route = createFileRoute("/api/public/cron/daily-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const body = (await request.json().catch(() => ({}))) as { kind?: string };
        const kind = body.kind === "reminder" ? "reminder" : "word";

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
        if (!lovableKey || !connectionKey) {
          return Response.json({ error: "Push not configured" }, { status: 500 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
        const today = saoPauloToday();

        const messages = new Map<string, { title: string; body: string; path: string }>();
        for (const p of profiles ?? []) {
          if (kind === "reminder") {
            if (p.last_activity_date === today) continue; // already studied today
            messages.set(p.id, {
              title: "Hora de estudar inglês 📚",
              body: "Você ainda não estudou hoje. Faça uma atividade rápida e mantenha seu Streak!",
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
            console.error(`daily-push FCM failed [${res.status}]: ${await res.text()}`);
            if (res.status === 404 || res.status === 400) stale.push(t.token);
          }
        }
        if (stale.length) await supabaseAdmin.from("push_tokens").delete().in("token", stale);

        return Response.json({ kind, sent, removed: stale.length });
      },
    },
  },
});

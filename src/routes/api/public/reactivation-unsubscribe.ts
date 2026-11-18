import { createFileRoute } from "@tanstack/react-router";
import { verifyReactivationUnsubscribeToken } from "@/lib/reactivationUnsubscribe.server";

function confirmationPage(userId: string, token: string) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Cancelar e-mails</title><body style="font-family:Arial,sans-serif;max-width:560px;margin:64px auto;padding:24px;color:#173638"><h1>Cancelar e-mails de reativação</h1><p>Confirme para deixar de receber lembretes de reativação do Evoluir+ English AI.</p><form method="post"><input type="hidden" name="user" value="${userId}"><input type="hidden" name="token" value="${token}"><button style="background:#00bda9;border:0;border-radius:8px;padding:12px 18px;font-weight:bold" type="submit">Confirmar cancelamento</button></form></body></html>`;
}

async function unsubscribe(userId: string, token: string) {
  if (!verifyReactivationUnsubscribeToken(userId, token)) {
    return new Response("Link inválido ou expirado.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("learning_profile").select("learning_preferences").eq("user_id", userId).maybeSingle();
  if (error) return new Response("Não foi possível atualizar sua preferência. Tente novamente.", { status: 500 });
  const current = data?.learning_preferences && typeof data.learning_preferences === "object" && !Array.isArray(data.learning_preferences)
    ? data.learning_preferences as Record<string, unknown> : {};
  const preferences = { ...current, reactivation_email_opt_in: false };
  const result = data
    ? await supabaseAdmin.from("learning_profile").update({ learning_preferences: preferences }).eq("user_id", userId)
    : await supabaseAdmin.from("learning_profile").insert({ user_id: userId, learning_preferences: preferences });
  if (result.error) return new Response("Não foi possível atualizar sua preferência. Tente novamente.", { status: 500 });
  return new Response("<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>Preferência atualizada</title><body style=\"font-family:Arial,sans-serif;max-width:560px;margin:64px auto;padding:24px;color:#173638\"><h1>Recebimento cancelado</h1><p>Você não receberá mais e-mails de reativação do Evoluir+ English AI.</p></body></html>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const Route = createFileRoute("/api/public/reactivation-unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("user") ?? "";
        const token = url.searchParams.get("token") ?? "";
        if (!verifyReactivationUnsubscribeToken(userId, token)) return new Response("Link inválido ou expirado.", { status: 400 });
        return new Response(confirmationPage(userId, token), { headers: { "Content-Type": "text/html; charset=utf-8" } });
      },
      POST: async ({ request }) => {
        const form = await request.formData();
        return unsubscribe(String(form.get("user") ?? ""), String(form.get("token") ?? ""));
      },
    },
  },
});

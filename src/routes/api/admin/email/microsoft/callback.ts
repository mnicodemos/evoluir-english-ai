import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/email/microsoft/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const destination = new URL("/admin", request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error");
        // Finish the exchange in an authenticated server function after returning
        // to the app, so all database writes use the signed-in Lovable Cloud session
        // and administrator RLS policies rather than a Supabase service-role key.
        if (providerError || !code || !state) {
          destination.searchParams.set("emailConnection", "failed");
        } else {
          destination.searchParams.set("emailCode", code);
          destination.searchParams.set("emailState", state);
        }
        return Response.redirect(destination, 303);
      },
    },
  },
});

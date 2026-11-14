import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends the first-course welcome after the student completes onboarding.
 * Authentication supplies the recipient; the browser cannot choose an address.
 * A stable idempotency key prevents duplicate sends on retries.
 */
export const sendStudentWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lang: z.enum(["pt", "en"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw new Error("Student profile could not be loaded for welcome email.");
    const recipient = profile?.email?.trim();
    if (!recipient) return { sent: false as const, reason: "missing_email" as const };

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("welcome", recipient, {
      templateData: {
        lang: data.lang,
        studentName: profile?.name?.trim() || "",
      },
      idempotencyKey: `student-welcome:${context.userId}`,
    });

    return result.sent
      ? { sent: true as const }
      : { sent: false as const, reason: result.reason };
  });

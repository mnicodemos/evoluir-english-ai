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
    const sendAndRecord = async (campaign: "welcome" | "premium-benefits") => {
      const idempotencyKey = `student-${campaign}:${context.userId}`;
      const { error: pendingError } = await supabaseAdmin.from("email_campaign_deliveries").upsert(
        {
          user_id: context.userId,
          campaign,
          status: "pending",
          recipient_email: recipient,
          idempotency_key: idempotencyKey,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,campaign" },
      );
      if (pendingError) throw pendingError;
      try {
        const result = await sendTemplateEmail(campaign, recipient, {
          templateData: { lang: data.lang, studentName: profile?.name?.trim() || "" },
          idempotencyKey,
        });
        const status = result.sent ? "sent" : "suppressed";
        const { error: updateError } = await supabaseAdmin
          .from("email_campaign_deliveries")
          .update({
            status,
            sent_at: result.sent ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
            last_error: result.sent ? null : "Recipient suppressed by email provider",
          })
          .eq("user_id", context.userId)
          .eq("campaign", campaign);
        if (updateError) throw updateError;
        return result;
      } catch (sendError) {
        await supabaseAdmin
          .from("email_campaign_deliveries")
          .update({
            status: "failed",
            last_error:
              sendError instanceof Error ? sendError.message.slice(0, 500) : "Unknown email error",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", context.userId)
          .eq("campaign", campaign);
        throw sendError;
      }
    };

    const result = await sendAndRecord("welcome");
    if (!result.sent) return { sent: false as const, reason: result.reason };
    // The managed app-email service cannot send promotional Premium upsells.
    return { sent: true as const, premiumSent: false };
  });

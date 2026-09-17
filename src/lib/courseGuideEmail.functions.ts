import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(200),
  lang: z.enum(["pt", "en"]).default("pt"),
});

/** Sends the course/methodology guide to a visitor who submitted their email on the landing page. */
export const sendCourseGuideEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const key = `course-guide-${data.email.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
    const result = await sendTemplateEmail("course-guide", data.email, {
      templateData: { lang: data.lang },
      idempotencyKey: key,
    });
    return { sent: result.sent };
  });

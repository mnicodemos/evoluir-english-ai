import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const adventureId = z.enum([
  "a1-welcome-mix-up",
  "a1-neighbourhood-mystery",
  "a2-surprise-delivery",
  "a2-community-festival",
]);

const checkpointSchema = z
  .object({
    adventureId,
    currentStep: z.number().int().min(0).max(10),
    choices: z.record(z.string(), z.number().int().min(0).max(2)).default({}),
    decisions: z.array(z.string().max(40)).max(10).default([]),
    recovered: z.number().int().min(0).max(100).default(0),
    completedActivityIds: z
      .array(
        z
          .string()
          .regex(
            /^(a1-welcome-mix-up|a1-neighbourhood-mystery|a2-surprise-delivery|a2-community-festival):[0-9]$/,
          ),
      )
      .max(10)
      .default([]),
    completed: z.boolean().default(false),
    expectedRevision: z.number().int().min(0),
    restart: z.boolean().default(false),
  })
  .strict();

export const loadEnglishAdventureCheckpoints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // This table is introduced by the matching Lovable Cloud migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("english_adventure_checkpoints")
      .select(
        [
          "adventure_id",
          "current_step",
          "choices",
          "decisions",
          "recovered",
          "completed_activity_ids",
          "completed",
          "revision",
          "updated_at",
        ].join(", "),
      )
      .eq("user_id", context.userId);

    if (error) throw new Error("English Adventure progress could not be loaded");
    return data ?? [];
  });

export const saveEnglishAdventureCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkpointSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The service-role client is only used inside this authenticated server function.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: result, error } = await db.rpc("save_english_adventure_checkpoint", {
      p_user_id: context.userId,
      p_adventure_id: data.adventureId,
      p_current_step: data.currentStep,
      p_choices: data.choices,
      p_decisions: data.decisions,
      p_recovered: data.recovered,
      p_completed_activity_ids: data.completedActivityIds,
      p_completed: data.completed,
      p_expected_revision: data.expectedRevision,
      p_restart: data.restart,
    });

    if (error || !result?.checkpoint) {
      throw new Error("English Adventure progress could not be saved");
    }
    return result as {
      saved: boolean;
      checkpoint: {
        adventure_id: string;
        current_step: number;
        choices: Record<string, number>;
        decisions: string[];
        recovered: number;
        completed_activity_ids: string[];
        completed: boolean;
        revision: number;
        updated_at: string;
      };
    };
  });

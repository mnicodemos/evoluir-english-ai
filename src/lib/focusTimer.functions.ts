import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FocusState } from "@/lib/focusTimer";

const focusStateSchema = z
  .object({
    preset: z.enum(["classic", "short", "deep"]),
    phase: z.enum(["idle", "focus", "break"]),
    endsAt: z.number().nullable(),
    left: z.number().nullable(),
    blocks: z.number().int().min(0).max(1000),
    taskId: z.string().uuid().nullable(),
    key: z.string().max(100).nullable(),
    lastTaskId: z.string().uuid().nullable(),
    startedAt: z.number().nullable(),
    activity: z.string().max(40).nullable(),
  })
  .strict();

const focusLogSchema = z
  .object({
    key: z.string().min(1).max(100),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    minutes: z.number().int().min(1).max(1440),
    partial: z.boolean().optional(),
    startedAt: z.number().nullable().optional(),
    endedAt: z.number(),
    preset: z.enum(["classic", "short", "deep"]),
    taskId: z.string().uuid().nullable().optional(),
    activity: z.string().max(40).nullable().optional(),
  })
  .strict();

export const loadFocusCloudSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The Focus tables are added by the matching Lovable Cloud migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const [stateRead, logsRead] = await Promise.all([
      db
        .from("focus_timer_state")
        .select("state, revision")
        .eq("user_id", context.userId)
        .maybeSingle(),
      db
        .from("focus_session_logs")
        .select(
          "session_key, day, minutes, partial, started_at, ended_at, preset, task_id, activity",
        )
        .eq("user_id", context.userId)
        .gte("day", new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
        .order("day", { ascending: false }),
    ]);
    if (stateRead.error || logsRead.error) {
      throw new Error("Focus could not be synchronized.");
    }

    return {
      state: stateRead.data?.state ?? null,
      revision: Number(stateRead.data?.revision ?? 0),
      sessions: (logsRead.data ?? []).map((row: Record<string, unknown>) => ({
        key: row["session_key"],
        day: row["day"],
        minutes: row["minutes"],
        partial: row["partial"],
        startedAt: row["started_at"] ? new Date(String(row["started_at"])).getTime() : null,
        endedAt: new Date(String(row["ended_at"])).getTime(),
        preset: row["preset"],
        taskId: row["task_id"],
        activity: row["activity"],
      })),
    };
  });

export const saveFocusCloudSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        state: focusStateSchema,
        expectedRevision: z.number().int().min(0),
        sessions: z.array(focusLogSchema).max(500).default([]),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const [stateWrite, logsWrite] = await Promise.all([
      db.rpc("save_focus_timer_state", {
        p_user_id: context.userId,
        p_state: data.state,
        p_expected_revision: data.expectedRevision,
      }),
      db.rpc("save_focus_session_logs", {
        p_user_id: context.userId,
        p_sessions: data.sessions,
      }),
    ]);
    if (stateWrite.error || logsWrite.error || !stateWrite.data) {
      throw new Error("Focus could not be synchronized.");
    }
    return stateWrite.data as {
      saved: boolean;
      revision: number;
      state: FocusState;
    };
  });

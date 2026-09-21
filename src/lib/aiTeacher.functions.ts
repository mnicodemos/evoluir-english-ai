// AI Teacher backend. Reuses the existing AI gateway (quota, cache, telemetry,
// AiError handling), the existing pedagogical pipeline (evidence -> skill result
// -> profile) and the existing auth middleware. No new gateway, no new profile,
// no new evidence model, no UI.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway } from "@/lib/ai-gateway.server";
import { deterministicUuid, persistTeacherEvidence } from "@/lib/pedagogy/dualWrite.functions";
import { itemLevelFromStoredLevel } from "@/lib/pedagogy/cefr";
import { loadTeacherContext } from "@/lib/pedagogy/teacherContext.server";
import { classifyTeacherMode } from "@/lib/pedagogy/teacherMode";
import {
  teacherEvidence,
  teacherEvidenceDecision,
  TEACHER_RUBRIC_VERSION,
} from "@/lib/pedagogy/teacherEvidence";
import { parseTeacherTurn, teacherTurnMessages } from "@/lib/pedagogy/teacherPrompt";

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

// The client sends conversation content only. It can never declare score, CEFR,
// confidence, skill results or evidence: the schema is strict, so any such field
// is rejected before the handler runs.
const teacherTurnInputSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    lessonId: z.string().uuid().optional(),
    objective: z.string().trim().min(1).max(200).default("Help the student improve their English."),
    message: z.string().trim().min(1).max(2000),
    history: z.array(historyMessageSchema).max(20).default([]),
    // The student may only ask for a guided session. Focus, level, stage and
    // any assessment stay server-side.
    coach: z.boolean().optional(),
  })
  .strict();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const teacherTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => teacherTurnInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const pedagogicalContext = await loadTeacherContext(userId, {
      lessonId: data.lessonId ?? null,
    });

    // Mode is classified on the server from the student's own turn: the client
    // cannot declare a mode, a level or a skill. The only client intent allowed
    // is "I want a guided session" (coach).
    const mode = data.coach
      ? "COACH"
      : classifyTeacherMode({ message: data.message, history: data.history });

    // Coach session state is derived server-side: stage from the conversation
    // shape, focus from the existing next-step priority logic.
    let coach: { stage: CoachStage; focusSkill: string | null; turns: number } | null = null;
    let coachPromptBlock: string | undefined;
    if (mode === "COACH") {
      const turns = coachStudentTurns(data.history);
      const stage = coachStage(turns);
      const focus = coachFocus(pedagogicalContext);
      coach = { stage, focusSkill: focus.skill, turns };
      coachPromptBlock = coachBlock(focus, stage, turns);
    }

    const raw = await callGateway(
      teacherTurnMessages({
        context: pedagogicalContext,
        objective: data.objective,
        studentMessage: data.message,
        history: data.history,
        mode,
        ...(coachPromptBlock ? { coachBlock: coachPromptBlock } : {}),
      }),
      true,
      { userId, operation: "teacher" },
    );
    const turn = parseTeacherTurn(raw);

    // Conversation storage reuses the existing ai_conversations table (RLS: owner only).
    const db = await admin();
    let conversationId = data.conversationId ?? null;
    if (conversationId) {
      const { data: owned } = await db
        .from("ai_conversations")
        .select("id, messages")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!owned) conversationId = null;
      else {
        const previous = Array.isArray(owned.messages) ? owned.messages : [];
        await db
          .from("ai_conversations")
          .update({
            messages: [
              ...previous.slice(-38),
              { role: "user", content: data.message },
              { role: "assistant", content: turn.reply },
            ],
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId)
          .eq("user_id", userId);
      }
    }
    if (!conversationId) {
      const { data: created } = await db
        .from("ai_conversations")
        .insert({
          user_id: userId,
          topic: "AI Teacher",
          scenario: "teacher",
          messages: [
            { role: "user", content: data.message },
            { role: "assistant", content: turn.reply },
          ],
        })
        .select("id")
        .single();
      conversationId = created?.id ?? null;
    }

    // Server-side gate: the model only SUGGESTS an assessment. Evidence is
    // persisted through the existing pipeline, and only for real production.
    const decision = teacherEvidenceDecision({
      assessable: turn.assessable,
      focusSkill: turn.focusSkill,
      suggestedScore: turn.suggestedScore,
      studentMessage: data.message,
    });
    let evidencePersisted = false;
    if (decision.assess && conversationId) {
      const turnId = await deterministicUuid(
        `teacher-turn:${userId}:${conversationId}:${data.message}`,
      );
      const result = await persistTeacherEvidence({
        userId,
        turnId,
        rubricVersion: TEACHER_RUBRIC_VERSION,
        evidence: teacherEvidence({
          skill: decision.skill,
          score: decision.score,
          turnId,
          // Level of the interaction, taken from the server-owned context.
          itemCefr: itemLevelFromStoredLevel(pedagogicalContext.cefrLevel),
        }),
      });
      evidencePersisted = result.ok && !result.duplicate;
    }

    return {
      conversationId,
      mode,
      reply: turn.reply,
      correction: turn.observedError,
      evidencePersisted,
      evidenceSkill: decision.assess ? decision.skill : null,
    };
  });

// Read-only session bootstrap for the AI Teacher UI: the display context comes
// from the server (never computed on the client) plus the student's latest
// teacher conversation, read with the user's own RLS-scoped client.
export const loadTeacherSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lessonId: z.string().uuid().optional(),
        conversationId: z.string().uuid().optional(),
      })
      .strict()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const pedagogicalContext = await loadTeacherContext(context.userId, {
      lessonId: data.lessonId ?? null,
    });

    let query = context.supabase
      .from("ai_conversations")
      .select("id, messages, updated_at")
      .eq("scenario", "teacher")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (data.conversationId) query = query.eq("id", data.conversationId);
    const { data: rows } = await query;
    const conversation = rows?.[0] ?? null;

    const focus =
      pedagogicalContext.currentActivity?.skill ??
      [...pedagogicalContext.skills].sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0]
        ?.skill ??
      null;

    return {
      context: {
        cefrLevel: pedagogicalContext.currentActivity?.cefrLevel ?? pedagogicalContext.cefrLevel,
        focusSkill: focus,
        lessonTitle: pedagogicalContext.currentActivity?.lessonTitle ?? null,
      },
      conversation: conversation
        ? { id: conversation.id as string, messages: conversation.messages }
        : null,
    };
  });

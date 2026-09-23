// Server side of the Proof of Progress. Reads only the caller's own data through
// the existing tables/views. The client sends nothing: no skill, no level, no
// score, no evidence — the server stays the single authority.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AssessmentEvidence, PedagogicalSkill } from "./contracts";
import { deriveProofOfProgress, type ProofOfProgress } from "./proofOfProgress";

/** Existing evidence rows considered. Read-only, same limit as the next step. */
const EVIDENCE_LIMIT = 400;

export const loadProofOfProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProofOfProgress> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [profile, history, sessions, evidenceRows] = await Promise.all([
      supabaseAdmin.from("profiles").select("level").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("assessment_skill_results")
        .select("skill, score, cefr_level, assessed_at, assessment_sessions!inner(status)")
        .eq("user_id", userId)
        .eq("assessment_sessions.status", "completed")
        .order("assessed_at", { ascending: true }),
      // Officially recorded levels only. Nothing here infers or changes a level.
      supabaseAdmin
        .from("assessment_sessions")
        .select("overall_cefr, completed_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("overall_cefr", "is", null)
        .order("completed_at", { ascending: true }),
      supabaseAdmin
        .from("assessment_evidence")
        .select(
          "id, skill, subskill, source_type, source_id, source_item_id, raw_score, source_reliability, evidence_quality, sample_weight, evaluated_by, rubric_version, metadata, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(EVIDENCE_LIMIT),
    ]);

    const evidence: AssessmentEvidence[] = (evidenceRows.data ?? []).map((row) => ({
      id: row.id,
      skill: row.skill as PedagogicalSkill,
      subskill: row.subskill,
      sourceType: row.source_type as AssessmentEvidence["sourceType"],
      sourceId: row.source_id,
      sourceItemId: row.source_item_id,
      rawScore: Number(row.raw_score),
      sourceReliability: Number(row.source_reliability),
      evidenceQuality: Number(row.evidence_quality),
      sampleWeight: Number(row.sample_weight),
      evaluatedBy: row.evaluated_by as AssessmentEvidence["evaluatedBy"],
      rubricVersion: row.rubric_version,
      metadata: (row.metadata ?? {}) as NonNullable<AssessmentEvidence["metadata"]>,
      createdAt: row.created_at,
    }));

    return deriveProofOfProgress({
      evidence,
      currentLevel: profile.data?.level ?? null,
      skillHistory: (history.data ?? []).map((row) => ({
        skill: row.skill,
        score: row.score === null ? null : Number(row.score),
        cefrLevel: row.cefr_level,
        assessedAt: row.assessed_at,
      })),
      levelHistory: (sessions.data ?? []).map((row) => ({
        level: row.overall_cefr,
        at: row.completed_at,
      })),
    });
  });

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertClaimNotFrozen } from "#/server-actions/admin-approvals/assert-claim-not-frozen";
import { checkReservedCapacityForStandaloneClaim } from "#/server-actions/tutor-allocations/check-reserved-capacity";
import { assertScheduledSessionActiveForClaimLink } from "#/server-actions/scheduled-sessions/session-lifecycle";
import {
  appendClaimWorkflowEvent,
  CLAIM_WORKFLOW_ACTION,
} from "#/lib/claim-workflow-timeline";
import {
  isNoShowWithEvidence,
  normalizeNoShowReason,
} from "#/lib/session-claim-lifecycle";
import { normalizeSupabaseNestedRow } from "#/lib/supabase-nested-row";
import { isTutorSessionClaimVisible } from "#/lib/tutor-manual-session-claim";

type Db = SupabaseClient;

export type ClaimSubmissionMode =
  | {
      kind: "tutor";
      /** Runs after all eligibility checks pass, before anything is written (step-up MFA). */
      attest: () => Promise<void>;
      noShowReason?: string;
    }
  | { kind: "auto" };

/**
 * Move a DRAFT claim to PENDING_VERIFICATION. Shared by tutor submit and
 * institution auto-submit so both enforce the same eligibility rules.
 * Throws a user-safe Error when the claim cannot be submitted.
 */
export async function submitClaimForVerification(
  db: Db,
  input: { claimId: string; tutorId: string; mode: ClaimSubmissionMode },
): Promise<{ escalated: boolean }> {
  const { claimId, tutorId, mode } = input;

  const { data: row, error: selErr } = await db
    .from("session_claims")
    .select(
      `
      id,
      status,
      frozen_at,
      module_id,
      hours,
      session_date,
      attendance_present_count,
      source_scheduled_session_id,
      source_schedule_import_id,
      admin_creation_approved_at,
      request_status,
      module:modules ( institution_id )
    `,
    )
    .eq("id", claimId)
    .eq("tutor_id", tutorId)
    .is("deleted_at", null)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);
  if (!row) throw new Error("Session not found.");
  if (!isTutorSessionClaimVisible(row)) {
    throw new Error(
      "This session is awaiting approval before you can work on it.",
    );
  }
  if (row.status !== "DRAFT") {
    throw new Error("Only draft claims can be submitted.");
  }
  assertClaimNotFrozen(row.frozen_at as string | null, "submit this session");

  const linkedSessionId = row.source_scheduled_session_id as string | null;
  if (linkedSessionId) {
    await assertScheduledSessionActiveForClaimLink(db, linkedSessionId, "submit");
  } else if (row.module_id) {
    const mod = normalizeSupabaseNestedRow(
      row.module as { institution_id: string } | { institution_id: string }[] | null,
    );
    if (mod?.institution_id) {
      const rawH = row.hours as number | string;
      const hours =
        typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);
      await checkReservedCapacityForStandaloneClaim(db, {
        tutorId,
        moduleId: row.module_id as string,
        institutionId: mod.institution_id,
        hours: Number.isFinite(hours) ? hours : 0,
        sessionDate: row.session_date as string,
      });
    }
  }

  const { count: evidenceCount, error: evErr } = await db
    .from("attendance_evidence")
    .select("id", { count: "exact", head: true })
    .eq("claim_id", claimId);

  if (evErr) throw new Error(evErr.message);

  const noShow = isNoShowWithEvidence({
    attendancePresentCount: row.attendance_present_count as number | null,
    evidenceCount: evidenceCount ?? 0,
  });
  const reason =
    mode.kind === "tutor" ? normalizeNoShowReason(mode.noShowReason) : "";
  const escalateNoShow = noShow && reason.length < 10;

  if (mode.kind === "tutor") await mode.attest();

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await db
    .from("session_claims")
    .update({
      status: "PENDING_VERIFICATION",
      submitted_at: now,
      ...(mode.kind === "auto" ? { auto_submitted_at: now } : {}),
      ...(escalateNoShow ? { frozen_at: now } : {}),
    })
    .eq("id", claimId)
    .eq("tutor_id", tutorId)
    .eq("status", "DRAFT")
    .select("id")
    .maybeSingle();

  if (upErr) throw new Error(upErr.message);
  if (!updated) throw new Error("Only draft claims can be submitted.");

  const isTutor = mode.kind === "tutor";
  await appendClaimWorkflowEvent(db, {
    claimId,
    actorId: tutorId,
    actionType: escalateNoShow
      ? CLAIM_WORKFLOW_ACTION.NO_SHOW_ESCALATED
      : isTutor
        ? CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED
        : CLAIM_WORKFLOW_ACTION.AUTO_SUBMITTED,
    fromStatus: "DRAFT",
    toStatus: "PENDING_VERIFICATION",
    comment: escalateNoShow
      ? `${isTutor ? "Submitted" : "Auto-submitted"} with register evidence and zero attendance; no explanation provided.`
      : isTutor
        ? noShow
          ? reason
          : null
        : "Submitted automatically by institution policy; not attested by the tutor.",
    mfaConfirmed: isTutor,
    mfaMethod: isTutor ? "TOTP_STEP_UP" : null,
  });

  return { escalated: escalateNoShow };
}

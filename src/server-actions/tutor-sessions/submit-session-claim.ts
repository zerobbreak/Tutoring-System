import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { assertClaimNotFrozen } from "#/server-actions/admin-approvals/assert-claim-not-frozen";
import { checkReservedCapacityForStandaloneClaim } from "#/server-actions/tutor-allocations/check-reserved-capacity";
import {
  appendClaimWorkflowEvent,
  CLAIM_WORKFLOW_ACTION,
} from "#/lib/claim-workflow-timeline";
import {
  isNoShowWithEvidence,
  normalizeNoShowReason,
} from "#/lib/session-claim-lifecycle";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { isTutorSessionClaimVisible } from "#/lib/tutor-manual-session-claim";
import { assertScheduledSessionActiveForClaimLink } from "#/server-actions/scheduled-sessions/session-lifecycle";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

const submitClaimSchema = z.object({
  claimId: z.string().uuid(),
  noShowReason: z.string().max(2000).optional(),
});

/** Submit a draft claim for verification. */
export const submitSessionClaimFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        status,
        frozen_at,
        attendance_present_count,
        source_scheduled_session_id,
        source_schedule_import_id,
        admin_creation_approved_at
      `,
      )
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
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
      await assertScheduledSessionActiveForClaimLink(
        supabase,
        linkedSessionId,
        "submit",
      );
    }

    if (!row.source_scheduled_session_id) {
      const { data: claimFull, error: fullErr } = await supabase
        .from("session_claims")
        .select(
          "module_id, hours, session_date, module:modules ( institution_id )",
        )
        .eq("id", data.claimId)
        .eq("tutor_id", tutorId)
        .maybeSingle();

      if (fullErr) throw new Error(fullErr.message);
      if (claimFull?.module_id) {
        const mod = claimFull.module as
          | { institution_id: string }
          | { institution_id: string }[]
          | null;
        const institutionId = Array.isArray(mod)
          ? mod[0]?.institution_id
          : mod?.institution_id;
        if (institutionId) {
          const rawH = claimFull.hours as number | string;
          const hours =
            typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);
          await checkReservedCapacityForStandaloneClaim(supabase, {
            tutorId,
            moduleId: claimFull.module_id as string,
            institutionId,
            hours: Number.isFinite(hours) ? hours : 0,
            sessionDate: claimFull.session_date as string,
          });
        }
      }
    }

    const { count: evidenceCount, error: evErr } = await supabase
      .from("attendance_evidence")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", data.claimId);

    if (evErr) throw new Error(evErr.message);

    const noShow = isNoShowWithEvidence({
      attendancePresentCount: row.attendance_present_count as number | null,
      evidenceCount: evidenceCount ?? 0,
    });
    const reason = normalizeNoShowReason(data.noShowReason);
    const hasNoShowReason = reason.length >= 10;

    const submittedAt = new Date().toISOString();
    const escalateNoShow = noShow && !hasNoShowReason;

    const { error: upErr } = await supabase
      .from("session_claims")
      .update({
        status: "PENDING_VERIFICATION",
        submitted_at: submittedAt,
        ...(escalateNoShow ? { frozen_at: submittedAt } : {}),
      })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (upErr) throw new Error(upErr.message);

    if (escalateNoShow) {
      await appendClaimWorkflowEvent(supabase, {
        claimId: data.claimId,
        actorId: tutorId,
        actionType: CLAIM_WORKFLOW_ACTION.NO_SHOW_ESCALATED,
        fromStatus: "DRAFT",
        toStatus: "PENDING_VERIFICATION",
        comment:
          "Submitted with register evidence and zero attendance; no explanation provided.",
      });
    } else {
      await appendClaimWorkflowEvent(supabase, {
        claimId: data.claimId,
        actorId: tutorId,
        actionType: CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED,
        fromStatus: "DRAFT",
        toStatus: "PENDING_VERIFICATION",
        comment: noShow ? reason : null,
      });
    }

    return { ok: true as const, escalated: escalateNoShow };
  });

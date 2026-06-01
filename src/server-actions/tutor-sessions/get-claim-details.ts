import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import {
  buildClaimWorkflowTimeline,
  type WorkflowTimelineEntry,
} from "#/lib/claim-workflow-timeline";
import type { ClaimStatus } from "#/lib/session-kanban-column";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { isTutorManualSessionClaim } from "#/lib/tutor-manual-session-claim";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import {
  loadSessionAttendanceRecords,
  mapClaimRow,
  signAttendanceEvidenceUrl,
  type RawClaim,
} from "#/server-actions/tutor-sessions/mappers";
import type {
  ClaimDetailsDTO,
  ClaimEvidenceDTO,
  VerificationActionDTO,
} from "#/server-actions/tutor-sessions/types";

/** Get detailed information for a single claim, including history and evidence. */
export const getClaimDetailsFn = createServerFn({
  method: "GET",
})
  .inputValidator((input: unknown) =>
    z.object({ claimId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<ClaimDetailsDTO> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claimRow, error: cErr } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        module_id,
        session_date,
        start_time,
        end_time,
        hours,
        venue,
        status,
        notes,
        topics_covered,
        coverage_validated_at,
        submitted_at,
        source_scheduled_session_id,
        source_schedule_import_id,
        admin_creation_approved_at,
        admin_creation_approved_by,
        session_kind,
        attendance_present_count,
        attendance_expected_count,
        qr_token,
        qr_expires_at,
        tutor:users!session_claims_tutor_id_fkey ( id, full_name, email ),
        approver:users!session_claims_admin_creation_approved_by_fkey (
          id,
          full_name,
          email
        ),
        module:modules (
          id,
          code,
          name,
          lecturer_id,
          lecturer:users!modules_lecturer_id_fkey ( id, full_name, email )
        )
      `,
      )
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claimRow) throw new Error("Claim not found.");

    const { data: evRows, error: evErr } = await supabase
      .from("attendance_evidence")
      .select("id, file_url, original_filename, uploaded_at")
      .eq("claim_id", data.claimId)
      .order("uploaded_at", { ascending: false });

    if (evErr) throw new Error(evErr.message);

    const evidence: ClaimEvidenceDTO[] = [];
    for (const r of evRows ?? []) {
      let file_url = r.file_url as string;
      const signed = await signAttendanceEvidenceUrl(supabase, file_url);
      if (signed) file_url = signed;
      evidence.push({
        id: r.id as string,
        file_name: r.original_filename as string,
        file_url,
        uploaded_at: (r.uploaded_at as string) || new Date().toISOString(),
      });
    }

    const { data: historyRows, error: hErr } = await supabase
      .from("verification_actions")
      .select(
        `
        id,
        claim_id,
        actor_id,
        action_type,
        from_status,
        to_status,
        comment,
        acted_at,
        actor:users ( id, full_name, email )
      `,
      )
      .eq("claim_id", data.claimId)
      .order("acted_at", { ascending: false });

    if (hErr) throw new Error(hErr.message);

    const storedHistory: WorkflowTimelineEntry[] = (historyRows ?? []).map(
      (r: {
        id: string;
        claim_id: string;
        actor_id: string;
        action_type: string;
        from_status: string | null;
        to_status: string | null;
        comment: string | null;
        acted_at: string;
        actor: VerificationActionDTO["actor"] | VerificationActionDTO["actor"][];
      }) => {
        const actor = Array.isArray(r.actor) ? r.actor[0] : r.actor;
        return {
          id: r.id,
          claim_id: r.claim_id,
          actor_id: r.actor_id,
          actor,
          action_type: r.action_type,
          from_status: r.from_status as ClaimStatus,
          to_status: r.to_status as ClaimStatus,
          comment: r.comment,
          acted_at: r.acted_at,
        };
      },
    );

    const row = claimRow as {
      submitted_at: string | null;
      admin_creation_approved_at: string | null;
      source_scheduled_session_id: string | null;
      source_schedule_import_id: string | null;
      tutor:
        | { id: string; full_name: string; email: string }
        | { id: string; full_name: string; email: string }[]
        | null;
      approver:
        | { id: string; full_name: string; email: string }
        | { id: string; full_name: string; email: string }[]
        | null;
    };

    const tutorRaw = row.tutor;
    const tutorActor = Array.isArray(tutorRaw) ? tutorRaw[0] : tutorRaw;
    const approverRaw = row.approver;
    const approverActor = Array.isArray(approverRaw)
      ? approverRaw[0]
      : approverRaw;

    const history = buildClaimWorkflowTimeline({
      claimId: data.claimId,
      tutorId,
      tutorActor: tutorActor
        ? {
            id: tutorActor.id,
            full_name: tutorActor.full_name,
            email: tutorActor.email,
          }
        : null,
      submittedAt: row.submitted_at,
      adminCreationApprovedAt: row.admin_creation_approved_at,
      adminCreationApprover: approverActor
        ? {
            id: approverActor.id,
            full_name: approverActor.full_name,
            email: approverActor.email,
          }
        : null,
      isManualSession: isTutorManualSessionClaim({
        source_scheduled_session_id: row.source_scheduled_session_id,
        source_schedule_import_id: row.source_schedule_import_id,
      }),
      stored: storedHistory,
    });

    const attendance_records = await loadSessionAttendanceRecords(
      supabase,
      data.claimId,
    );

    const mapped = mapClaimRow(claimRow as RawClaim, evidence.length);

    return {
      ...mapped,
      evidence,
      attendance_records,
      history,
    };
  });

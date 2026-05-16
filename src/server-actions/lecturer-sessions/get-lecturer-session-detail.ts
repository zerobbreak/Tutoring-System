import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { sessionBoundsLocal } from "#/lib/session-kanban-column";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { LECTURER_SESSION_CLAIM_SELECT } from "./constants";
import type { LecturerSessionDetailDTO, SessionAttendanceRowDTO } from "./types";

const BUCKET = "attendance_registers";

const claimIdSchema = z.object({
  claimId: z.string().uuid(),
});

const EVIDENCE_EXPECTED_STATUSES: readonly ClaimStatus[] = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "APPROVED",
];

export const getLecturerSessionDetailFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => claimIdSchema.parse(input))
  .handler(async ({ data }): Promise<LecturerSessionDetailDTO> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const { data: row, error: cErr } = await supabase
      .from("session_claims")
      .select(LECTURER_SESSION_CLAIM_SELECT)
      .eq("id", data.claimId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!row) throw new Error("Session not found.");

    const claim = row as Record<string, unknown>;
    const { evidenceCountByClaim, scanCountByClaim } = await loadClaimCounts(
      supabase,
      [data.claimId],
    );
    const evidenceCount = evidenceCountByClaim.get(data.claimId) ?? 0;
    const scanCount = scanCountByClaim.get(data.claimId) ?? 0;

    const status = claim.status as ClaimStatus;
    const missingEvidence =
      EVIDENCE_EXPECTED_STATUSES.includes(status) && evidenceCount === 0;

    const { end } = sessionBoundsLocal(
      claim.session_date as string,
      claim.start_time as string,
      claim.end_time as string,
    );
    const sessionEnded = end.getTime() < Date.now();

    const { data: evRows, error: evErr } = await supabase
      .from("attendance_evidence")
      .select("id, file_url, original_filename, uploaded_at")
      .eq("claim_id", data.claimId)
      .order("uploaded_at", { ascending: false });

    if (evErr) throw new Error(evErr.message);

    const evidence: LecturerSessionDetailDTO["evidence"] = [];
    for (const r of evRows ?? []) {
      let file_url = r.file_url as string;
      if (file_url.startsWith(`${BUCKET}/`)) {
        const path = file_url.slice(BUCKET.length + 1);
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) file_url = signed.signedUrl;
      }
      evidence.push({
        id: r.id as string,
        file_name: r.original_filename as string,
        file_url,
        uploaded_at: (r.uploaded_at as string) || new Date().toISOString(),
      });
    }

    const { data: attRows, error: attErr } = await supabase
      .from("session_attendance")
      .select(
        `
        id,
        status,
        check_in_time,
        is_verified,
        notes,
        student:students (
          full_name,
          email,
          student_reference
        )
      `,
      )
      .eq("session_id", data.claimId)
      .order("check_in_time", { ascending: false });

    if (attErr) throw new Error(attErr.message);

    const attendance_rows: SessionAttendanceRowDTO[] = (attRows ?? []).map(
      (r) => ({
        id: r.id as string,
        status: r.status as string,
        check_in_time: r.check_in_time as string | null,
        is_verified: Boolean(r.is_verified),
        notes: r.notes as string | null,
        student: unwrapOne(
          r.student as
            | SessionAttendanceRowDTO["student"]
            | SessionAttendanceRowDTO["student"][],
        ),
      }),
    );

    const attendance_by_status: Record<string, number> = {};
    for (const a of attendance_rows) {
      attendance_by_status[a.status] =
        (attendance_by_status[a.status] ?? 0) + 1;
    }

    const present = claim.attendance_present_count as number | null;
    const headcount_matches_scans =
      present != null ? present === scanCount : null;

    const { data: historyRows, error: hErr } = await supabase
      .from("verification_actions")
      .select(
        `
        id,
        action_type,
        from_status,
        to_status,
        comment,
        acted_at,
        actor:users ( full_name )
      `,
      )
      .eq("claim_id", data.claimId)
      .order("acted_at", { ascending: false });

    if (hErr) throw new Error(hErr.message);

    const timeline = (historyRows ?? []).map((r) => {
      const actor = unwrapOne(
        r.actor as { full_name: string } | { full_name: string }[] | null,
      );
      return {
        id: r.id as string,
        action_type: r.action_type as string,
        from_status: r.from_status as ClaimStatus | null,
        to_status: r.to_status as ClaimStatus | null,
        comment: r.comment as string | null,
        acted_at: r.acted_at as string,
        actor_name: actor?.full_name ?? null,
      };
    });

    const rawH = claim.hours;
    const hours =
      typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);

    return {
      id: data.claimId,
      session_date: claim.session_date as string,
      start_time: claim.start_time as string,
      end_time: claim.end_time as string,
      hours: Number.isFinite(hours) ? hours : 0,
      venue: claim.venue as string | null,
      status,
      submitted_at: claim.submitted_at as string | null,
      session_kind: claim.session_kind as string | null,
      notes: claim.notes as string | null,
      topics_covered: claim.topics_covered as string | null,
      examples_used: claim.examples_used as string | null,
      student_struggles: claim.student_struggles as string | null,
      revision_topics: claim.revision_topics as string | null,
      attendance_present_count: present,
      attendance_expected_count: claim.attendance_expected_count as number | null,
      attendance_scan_count: scanCount,
      evidence_count: evidenceCount,
      missing_evidence: missingEvidence,
      completion_verified: status === "VERIFIED" || status === "APPROVED",
      session_ended: sessionEnded,
      linked_from_schedule: Boolean(
        claim.source_schedule_import_id || claim.source_scheduled_session_id,
      ),
      linked_from_lecturer_schedule: Boolean(claim.source_scheduled_session_id),
      qr_token: claim.qr_token as string | null,
      qr_expires_at: claim.qr_expires_at as string | null,
      qr_check_in_url: null,
      module: unwrapOne(
        claim.module as
          | { id: string; code: string; name: string }
          | { id: string; code: string; name: string }[]
          | null,
      ),
      tutor: unwrapOne(
        claim.tutor as
          | { id: string; full_name: string; email: string }
          | { id: string; full_name: string; email: string }[]
          | null,
      ),
      evidence,
      attendance_rows,
      attendance_by_status,
      timeline,
      headcount_matches_scans,
      can_verify: ["PENDING_VERIFICATION", "DISPUTED"].includes(status),
    };
  });

import type { ClaimStatus } from "#/lib/session-claim-display";
import { lecturerSessionTimeBucket } from "#/lib/lecturer-session-bucket";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import type { LecturerSessionCardDTO } from "./types";

const EVIDENCE_EXPECTED_STATUSES: readonly ClaimStatus[] = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "APPROVED",
];

type RawClaimRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number | string;
  venue: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  updated_at: string;
  session_kind: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  source_schedule_import_id: string | null;
  source_scheduled_session_id: string | null;
  module:
    | { id: string; code: string; name: string }
    | { id: string; code: string; name: string }[]
    | null;
  tutor:
    | { id: string; full_name: string; email: string }
    | { id: string; full_name: string; email: string }[]
    | null;
};

export function mapSessionCardRow(
  row: RawClaimRow,
  evidenceCount: number,
  scanCount: number,
  now: Date,
): LecturerSessionCardDTO {
  const rawH = row.hours;
  const hours =
    typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);

  const present = row.attendance_present_count;
  const expected = row.attendance_expected_count;
  const lowAttendance =
    present != null &&
    expected != null &&
    expected > 0 &&
    present / expected < 0.5 &&
    row.status !== "DRAFT";

  const missingEvidence =
    EVIDENCE_EXPECTED_STATUSES.includes(row.status) && evidenceCount === 0;

  return {
    id: row.id,
    session_date: row.session_date,
    start_time: row.start_time,
    end_time: row.end_time,
    hours: Number.isFinite(hours) ? hours : 0,
    venue: row.venue,
    status: row.status,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
    session_kind: row.session_kind,
    attendance_present_count: present,
    attendance_expected_count: expected,
    attendance_scan_count: scanCount,
    evidence_count: evidenceCount,
    time_bucket: lecturerSessionTimeBucket(
      now,
      row.session_date,
      row.start_time,
      row.end_time,
    ),
    missing_evidence: missingEvidence,
    low_attendance: lowAttendance,
    completion_verified: row.status === "VERIFIED" || row.status === "APPROVED",
    linked_from_schedule: Boolean(
      row.source_schedule_import_id || row.source_scheduled_session_id,
    ),
    module: unwrapOne(row.module),
    tutor: unwrapOne(row.tutor),
  };
}

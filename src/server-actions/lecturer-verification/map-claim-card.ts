import { unwrapOne } from "./unwrap";
import type { VerificationClaimCardDTO } from "./types";

type RawClaimRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number | string;
  venue: string | null;
  status: VerificationClaimCardDTO["status"];
  submitted_at: string | null;
  updated_at: string;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  module:
    | { id: string; code: string; name: string }
    | { id: string; code: string; name: string }[]
    | null;
  tutor:
    | { full_name: string; email: string }
    | { full_name: string; email: string }[]
    | null;
};

export function mapClaimCardRow(
  row: RawClaimRow,
  evidenceCount: number,
  scanCount: number,
): VerificationClaimCardDTO {
  const rawH = row.hours;
  const hours =
    typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);

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
    attendance_present_count: row.attendance_present_count,
    attendance_expected_count: row.attendance_expected_count,
    attendance_scan_count: scanCount,
    evidence_count: evidenceCount,
    module: unwrapOne(row.module),
    tutor: unwrapOne(row.tutor),
  };
}

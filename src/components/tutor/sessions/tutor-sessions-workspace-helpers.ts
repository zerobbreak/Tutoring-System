import {
  sessionBoundsLocal,
  type ClaimStatus,
} from "#/lib/session-kanban-column";
import type {
  ClaimDetailsDTO,
  TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

export function workspaceClaimFromDetails(
  detail: ClaimDetailsDTO,
): TutorSessionClaimDTO {
  return {
    id: detail.id,
    module_id: detail.module_id,
    session_date: detail.session_date,
    start_time: detail.start_time,
    end_time: detail.end_time,
    hours: detail.hours,
    venue: detail.venue,
    status: detail.status,
    notes: detail.notes,
    topics_covered: detail.topics_covered,
    coverage_validated_at: detail.coverage_validated_at,
    submitted_at: detail.submitted_at,
    session_kind: detail.session_kind,
    request_status: detail.request_status,
    request_reason: detail.request_reason,
    review_feedback: detail.review_feedback,
    attendance_present_count: detail.attendance_present_count,
    attendance_expected_count: detail.attendance_expected_count,
    attendance_locked_at: detail.attendance_locked_at,
    qr_token: detail.qr_token,
    qr_expires_at: detail.qr_expires_at,
    module: detail.module,
    evidenceCount: detail.evidence.length,
  };
}

export const ALL_STATUSES: ClaimStatus[] = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "DISPUTED",
  "REJECTED",
  "VERIFIED",
  "APPROVED",
];

export function claimTimes(claim: TutorSessionClaimDTO) {
  return {
    start: claim.start_time ?? "09:00",
    end: claim.end_time ?? "10:00",
  };
}

export function claimStatusRail(status: ClaimStatus): string {
  switch (status) {
    case "APPROVED":
    case "VERIFIED":
      return "border-l-emerald-500";
    case "PENDING_VERIFICATION":
      return "border-l-amber-500";
    case "DISPUTED":
    case "REJECTED":
      return "border-l-destructive";
    default:
      return "border-l-muted-foreground/30";
  }
}

export function isSessionLive(claim: TutorSessionClaimDTO, now: Date): boolean {
  const times = claimTimes(claim);
  const { start, end } = sessionBoundsLocal(
    claim.session_date,
    times.start,
    times.end,
  );
  return now >= start && now <= end;
}

export function isSessionUrgent(claim: TutorSessionClaimDTO, now: Date): boolean {
  if (claim.status === "DISPUTED" || claim.status === "REJECTED") return true;
  const times = claimTimes(claim);
  const { start } = sessionBoundsLocal(
    claim.session_date,
    times.start,
    times.end,
  );
  const ms = start.getTime() - now.getTime();
  if (ms <= 0 || ms > 2 * 60 * 60 * 1000) return false;
  return true;
}

import {
  isPendingSessionRequest,
  SESSION_REQUEST_STATUS,
} from "#/lib/session-request-status";

/** Claim created via tutor "Create session" (not schedule publish or import). */
export function isTutorManualSessionClaim(row: {
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
}): boolean {
  return (
    row.source_scheduled_session_id == null &&
    row.source_schedule_import_id == null
  );
}

/** Whether the claim may appear on tutor dashboards and session boards. */
export function isTutorSessionClaimVisible(row: {
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
  admin_creation_approved_at?: string | null;
  request_status?: string | null;
}): boolean {
  if (!isTutorManualSessionClaim(row)) return true;
  if (row.source_scheduled_session_id) return true;
  if (row.request_status === SESSION_REQUEST_STATUS.APPROVED) return true;
  if (row.admin_creation_approved_at != null) return true;
  return false;
}

/** Tutor can see their own request while pending, changes requested, or rejected. */
export function isTutorOwnSessionRequestVisible(row: {
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
  request_status?: string | null;
}): boolean {
  if (!isTutorManualSessionClaim(row)) return false;
  const status = row.request_status;
  return (
    status === SESSION_REQUEST_STATUS.PENDING ||
    status === SESSION_REQUEST_STATUS.CHANGES_REQUESTED ||
    status === SESSION_REQUEST_STATUS.REJECTED ||
    status == null
  );
}

export function isTutorSessionClaimListed(row: {
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
  admin_creation_approved_at?: string | null;
  request_status?: string | null;
}): boolean {
  return (
    isTutorSessionClaimVisible(row) || isTutorOwnSessionRequestVisible(row)
  );
}

/** PostgREST filter: schedule/import-linked OR approved manual. */
export const TUTOR_VISIBLE_SESSION_CLAIMS_OR_FILTER =
  "source_scheduled_session_id.not.is.null,source_schedule_import_id.not.is.null,admin_creation_approved_at.not.is.null,request_status.eq.APPROVED";

export { isPendingSessionRequest };

/** Claim created via tutor "Create session" (not schedule publish or import). */
export function isTutorManualSessionClaim(row: {
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
}): boolean {
  return (
    row.source_scheduled_session_id == null && row.source_schedule_import_id == null
  );
}

/** Whether the claim may appear on tutor dashboards and session boards. */
export function isTutorSessionClaimVisible(row: {
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
  admin_creation_approved_at?: string | null;
}): boolean {
  if (!isTutorManualSessionClaim(row)) return true;
  return row.admin_creation_approved_at != null;
}

/** PostgREST filter: schedule/import-linked OR admin-approved manual. */
export const TUTOR_VISIBLE_SESSION_CLAIMS_OR_FILTER =
  "source_scheduled_session_id.not.is.null,source_schedule_import_id.not.is.null,admin_creation_approved_at.not.is.null";

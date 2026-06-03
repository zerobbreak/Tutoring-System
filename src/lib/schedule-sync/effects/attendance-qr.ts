import type { SupabaseClient } from "@supabase/supabase-js";
import { subMinutes } from "date-fns";
import { ensureQrTokenForClaim } from "#/server-actions/tutor-sessions/student-roster";

/** Lock attendance and invalidate student self-registration QR for a claim. */
export async function lockClaimAttendanceAndInvalidateQr(
  db: SupabaseClient,
  claimId: string,
): Promise<void> {
  const now = new Date();
  const expiredAt = subMinutes(now, 1).toISOString();

  const { error } = await db
    .from("session_claims")
    .update({
      attendance_locked_at: now.toISOString(),
      qr_expires_at: expiredAt,
    })
    .eq("id", claimId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

/** Clear attendance lock when session is restored (if still in QR window). */
export async function unlockClaimAttendanceIfCancelledOnly(
  db: SupabaseClient,
  claimId: string,
): Promise<void> {
  const { error } = await db
    .from("session_claims")
    .update({ attendance_locked_at: null })
    .eq("id", claimId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

/** Refresh QR token expiry after time changes. */
export async function refreshClaimQrForSchedule(
  db: SupabaseClient,
  claimId: string,
): Promise<void> {
  await ensureQrTokenForClaim(db, claimId);
}

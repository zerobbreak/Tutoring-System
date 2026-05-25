import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "#/lib/supabase-admin";

/**
 * Service-role client for claim writes that belong to the signed-in tutor.
 * Falls back to the user JWT client when the service key is not configured.
 */
export async function resolveTutorClaimWriteDb(
  db: SupabaseClient,
  tutorId: string,
): Promise<SupabaseClient> {
  const admin = getSupabaseAdmin();
  if (!admin) return db;

  const {
    data: { user },
  } = await db.auth.getUser();
  if (user?.id === tutorId) return admin;
  return db;
}

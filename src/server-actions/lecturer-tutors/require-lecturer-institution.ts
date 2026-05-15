import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";

const INSTITUTION_REQUIRED_MSG =
  "Link your institution in Settings before managing tutors. Tutors must belong to the same institution as you.";

/**
 * Resolves the lecturer's institution from their profile or owned modules.
 */
export async function resolveLecturerInstitutionId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  lecturerId: string,
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const db = admin ?? supabase;

  const { data: userRow } = await db
    .from("users")
    .select("institution_id")
    .eq("id", lecturerId)
    .maybeSingle();

  if (userRow?.institution_id) {
    return userRow.institution_id as string;
  }

  const { data: mod } = await db
    .from("modules")
    .select("institution_id")
    .eq("lecturer_id", lecturerId)
    .not("institution_id", "is", null)
    .limit(1)
    .maybeSingle();

  const fromModule = (mod?.institution_id as string | null) ?? null;

  if (fromModule && admin && !userRow?.institution_id) {
    await admin
      .from("users")
      .update({ institution_id: fromModule })
      .eq("id", lecturerId);
  }

  return fromModule;
}

export async function requireLecturerInstitutionId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  lecturerId: string,
): Promise<string> {
  const institutionId = await resolveLecturerInstitutionId(supabase, lecturerId);
  if (!institutionId) {
    throw new Error(INSTITUTION_REQUIRED_MSG);
  }
  return institutionId;
}

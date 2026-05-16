import type { createSupabaseServerClient } from "#/lib/supabase-server";
import type { AdminContext } from "#/lib/admin-server";

export async function assertTargetUserInInstitution(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: AdminContext,
  targetUserId: string,
): Promise<Record<string, unknown>> {
  const { data: row, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", targetUserId)
    .eq("institution_id", ctx.institutionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("User not found in your institution.");

  return row as Record<string, unknown>;
}

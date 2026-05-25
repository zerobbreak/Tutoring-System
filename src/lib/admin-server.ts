import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePublicUserProfile } from "#/lib/ensure-public-user";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { isAdminDashboardRole } from "#/lib/user-role";

export type AdminContext = {
  userId: string;
  institutionId: string;
  role: string;
};

export async function requireAdminContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<AdminContext> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const role = user.user_metadata?.role as string | undefined;
  if (!isAdminDashboardRole(role)) {
    throw new Error("Admin access required.");
  }

  const dbRole = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
  await ensurePublicUserProfile(supabase, { role: dbRole });

  const { data: row, error: rowErr } = await supabase
    .from("users")
    .select("institution_id")
    .eq("id", user.id)
    .single();

  if (rowErr) throw new Error(rowErr.message);

  const institutionId = row?.institution_id as string | null;
  if (!institutionId) {
    throw new Error(
      "Your account is not linked to an institution. Contact support.",
    );
  }

  return { userId: user.id, institutionId, role: role ?? "ADMIN" };
}

/** Service-role client for admin mutations when configured; falls back to user JWT. */
export function resolveAdminWriteClient(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): SupabaseClient {
  return getSupabaseAdmin() ?? supabase;
}

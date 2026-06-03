import { ensurePublicUserProfile } from "#/lib/ensure-public-user";
import { getUserRole } from "#/lib/user-role";
import type { createSupabaseServerClient } from "#/lib/supabase-server";

export async function requireLecturerId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const role = getUserRole(user);
  if (role !== "LECTURER") {
    throw new Error("Lecturer access required.");
  }

  await ensurePublicUserProfile(supabase, { role: "LECTURER" });

  return user.id;
}

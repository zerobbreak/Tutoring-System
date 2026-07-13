import { ensurePublicUserProfile } from "#/lib/ensure-public-user";
import { getUserRole } from "#/lib/user-role";
import type { createSupabaseServerClient } from "#/lib/supabase-server";

export type UnlockResponderContext = {
  userId: string;
  institutionId: string;
  isAdmin: boolean;
};

export async function requireUnlockResponderContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<UnlockResponderContext> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const role = getUserRole(user);
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  if (!isAdmin && role !== "LECTURER") {
    throw new Error("Room access responder privileges required.");
  }

  await ensurePublicUserProfile(supabase, { role: role ?? "LECTURER" });

  const { data: profile, error: profErr } = await supabase
    .from("users")
    .select("institution_id, can_unlock_venues")
    .eq("id", user.id)
    .single();

  if (profErr) throw new Error(profErr.message);
  if (!profile?.institution_id) {
    throw new Error("Institution context required.");
  }

  if (!isAdmin && !profile.can_unlock_venues) {
    throw new Error("You are not authorized to manage room unlock requests.");
  }

  return {
    userId: user.id,
    institutionId: profile.institution_id as string,
    isAdmin,
  };
}

export async function requireTutorIdForUnlockPing(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<{ userId: string; institutionId: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const role = getUserRole(user);
  if (role !== "TUTOR") throw new Error("Tutor access required.");

  const { data: profile, error: profErr } = await supabase
    .from("users")
    .select("institution_id")
    .eq("id", user.id)
    .single();

  if (profErr) throw new Error(profErr.message);
  if (!profile?.institution_id) throw new Error("Institution context required.");

  return {
    userId: user.id,
    institutionId: profile.institution_id as string,
  };
}

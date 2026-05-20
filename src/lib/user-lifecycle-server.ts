import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasPlatformAccess,
  isAccountBlocked,
  isPendingApproval,
  lifecycleFromLegacyUser,
  type UserStatus,
} from "#/lib/user-status";

export type AuthUserLifecycle = {
  user_status: UserStatus;
  onboarding_step: string | null;
};

export async function fetchAuthUserLifecycle(
  supabase: SupabaseClient,
  userId: string,
): Promise<AuthUserLifecycle | null> {
  const { data, error } = await supabase
    .from("users")
    .select("user_status, onboarding_step")
    .eq("id", userId)
    .maybeSingle();

  if (!error && data?.user_status) {
    return {
      user_status: data.user_status as UserStatus,
      onboarding_step: (data.onboarding_step as string | null) ?? null,
    };
  }

  const { data: legacy, error: legacyError } = await supabase
    .from("users")
    .select("approval_status, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (legacyError || !legacy) return null;
  return lifecycleFromLegacyUser(legacy);
}

export async function requirePlatformAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const lifecycle = await fetchAuthUserLifecycle(supabase, userId);
  if (!lifecycle || !hasPlatformAccess(lifecycle.user_status)) {
    if (lifecycle && isAccountBlocked(lifecycle.user_status)) {
      throw new Error(
        lifecycle.user_status === "REJECTED"
          ? "Your account access was rejected. Contact your institution administrator."
          : "Your account is suspended. Contact your institution administrator.",
      );
    }
    if (lifecycle && isPendingApproval(lifecycle.user_status)) {
      throw new Error(
        "Complete onboarding in Settings before using this feature.",
      );
    }
    throw new Error("Your account does not have platform access.");
  }
}

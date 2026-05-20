import { supabase } from "#/lib/supabase";
import {
  hasPlatformAccess,
  isAccountBlocked,
  lifecycleFromLegacyUser,
  type UserStatus,
} from "#/lib/user-status";

export type ClientUserLifecycle = {
  user_status: UserStatus;
  onboarding_step: string | null;
};

export async function fetchAuthUserLifecycleClient(): Promise<ClientUserLifecycle | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("user_status, onboarding_step")
    .eq("id", user.id)
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
    .eq("id", user.id)
    .maybeSingle();

  if (legacyError || !legacy) return null;
  return lifecycleFromLegacyUser(legacy);
}

/** @deprecated Use fetchAuthUserLifecycleClient */
export async function fetchUserApprovalAllowed(): Promise<boolean> {
  const lifecycle = await fetchAuthUserLifecycleClient();
  if (!lifecycle) return true;
  return hasPlatformAccess(lifecycle.user_status);
}

export async function fetchUserHasPlatformAccess(): Promise<boolean> {
  return fetchUserApprovalAllowed();
}

export function isUserLifecycleBlocked(
  lifecycle: ClientUserLifecycle | null,
): boolean {
  if (!lifecycle) return false;
  return isAccountBlocked(lifecycle.user_status);
}

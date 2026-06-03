import {
  fetchAuthUserLifecycleClient,
  isUserLifecycleBlocked,
} from "#/lib/user-platform-gate";
import { APP_PATHS } from "#/lib/app-paths";
import { hasPlatformAccess } from "#/lib/user-status";
import type { PostAuthDestination } from "#/lib/user-role";

export type PlatformGateResult =
  | { allowed: true }
  | { allowed: false; redirect: PostAuthDestination };

/**
 * Client-side gate for dashboard layouts after MFA/session checks.
 */
export async function applyPlatformGate(): Promise<PlatformGateResult> {
  const lifecycle = await fetchAuthUserLifecycleClient();
  if (!lifecycle) return { allowed: true };

  if (isUserLifecycleBlocked(lifecycle)) {
    return { allowed: false, redirect: APP_PATHS.auth.accountBlocked };
  }

  if (!hasPlatformAccess(lifecycle.user_status)) {
    return { allowed: false, redirect: APP_PATHS.settings };
  }

  return { allowed: true };
}

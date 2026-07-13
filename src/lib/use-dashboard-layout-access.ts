import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type { AppShellUser } from "#/components/app-shell";
import { APP_PATHS } from "#/lib/app-paths";
import { applyPlatformGate } from "#/lib/apply-platform-gate";
import { gateAuthenticatedSession } from "#/lib/mfa-auth";
import { getUserRole } from "#/lib/user-role";

type DashboardRoleGuard = (role: string | undefined) => boolean;

type DashboardLayoutSearch = string | Record<string, unknown> | URLSearchParams | null | undefined;

export type DashboardLayoutAccessState = {
  user: AppShellUser | null;
  loading: boolean;
};

export function buildDashboardLayoutCurrentPath(
  pathname: string,
  search: DashboardLayoutSearch,
): string {
  if (!search) {
    return pathname;
  }

  if (typeof search === "string") {
    return search.startsWith("?") ? `${pathname}${search}` : search ? `${pathname}?${search}` : pathname;
  }

  if (search instanceof URLSearchParams) {
    const queryString = search.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
      continue;
    }

    params.append(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

/**
 * Shared auth and platform gate sequence for dashboard layout routes.
 */
export function useDashboardLayoutAccess(
  hasAccessToRole: DashboardRoleGuard,
): DashboardLayoutAccessState {
  const [user, setUser] = useState<AppShellUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const currentPath = buildDashboardLayoutCurrentPath(pathname, search);
  const encodedReturnTo = encodeURIComponent(currentPath);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const gate = await gateAuthenticatedSession();
        if (cancelled) return;

        if (gate.status === "unauthenticated") {
          navigate({
            to: APP_PATHS.auth.login,
            search: { returnTo: encodedReturnTo },
          });
          return;
        }

        if (gate.status === "mfa_required") {
          navigate({
            to: APP_PATHS.auth.mfa,
            search: { returnTo: encodedReturnTo },
          });
          return;
        }

        const role = getUserRole(gate.user);
        if (!hasAccessToRole(role)) {
          navigate({
            to: APP_PATHS.auth.login,
            search: { returnTo: encodedReturnTo },
          });
          return;
        }

        const gateResult = await applyPlatformGate();
        if (cancelled) return;

        if (!gateResult.allowed) {
          navigate({ to: gateResult.redirect });
          return;
        }

        setUser(gate.user);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [currentPath, hasAccessToRole, navigate]);

  return { user, loading };
}

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AppShellUser } from "#/components/app-shell";
import { applyPlatformGate } from "#/lib/apply-platform-gate";
import { gateAuthenticatedSession } from "#/lib/mfa-auth";

type DashboardRoleGuard = (role: string | undefined) => boolean;

export type DashboardLayoutAccessState = {
  user: AppShellUser | null;
  loading: boolean;
};

/**
 * Shared auth and platform gate sequence for dashboard layout routes.
 */
export function useDashboardLayoutAccess(
  hasAccessToRole: DashboardRoleGuard,
): DashboardLayoutAccessState {
  const [user, setUser] = useState<AppShellUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const gate = await gateAuthenticatedSession();
        if (cancelled) return;

        if (gate.status === "unauthenticated") {
          navigate({ to: "/auth/login" });
          return;
        }

        if (gate.status === "mfa_required") {
          navigate({ to: "/auth/mfa" });
          return;
        }

        const role = gate.user.user_metadata?.role as string | undefined;
        if (!hasAccessToRole(role)) {
          navigate({ to: "/auth/login" });
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
  }, [hasAccessToRole, navigate]);

  return { user, loading };
}

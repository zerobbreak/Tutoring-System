import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { IncomingMessagesListener } from "#/components/messaging/incoming-messages-listener";
import { AdminAppShell } from "#/components/admin-app-shell";
import { gateAuthenticatedSession } from "#/lib/mfa-auth";
import { isAdminDashboardRole } from "#/lib/user-role";
import { fetchUserApprovalAllowed } from "#/lib/user-approval-gate";
import type { AppShellUser } from "#/components/app-shell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const [user, setUser] = useState<AppShellUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const gate = await gateAuthenticatedSession();
      if (gate.status === "unauthenticated") {
        navigate({ to: "/auth/login" });
        return;
      }
      if (gate.status === "mfa_required") {
        navigate({ to: "/auth/mfa" });
        return;
      }
      const u = gate.user;
      const role = u.user_metadata?.role as string | undefined;
      if (!isAdminDashboardRole(role)) {
        navigate({ to: "/auth/login" });
        return;
      }
      const allowed = await fetchUserApprovalAllowed();
      if (!allowed) {
        navigate({ to: "/settings" });
        return;
      }
      setUser(u);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--lagoon-deep) border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminAppShell user={user}>
      <IncomingMessagesListener
        messagingPath="/admin/messaging"
        conversationSearchParam
      />
      <Outlet />
    </AdminAppShell>
  );
}

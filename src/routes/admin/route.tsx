import { createFileRoute, Outlet } from "@tanstack/react-router";
import { IncomingMessagesListener } from "#/components/messaging/incoming-messages-listener";
import { AdminAppShell } from "#/components/admin-app-shell";
import { isAdminDashboardRole } from "#/lib/user-role";
import { APP_PATHS } from "#/lib/app-paths";
import { useDashboardLayoutAccess } from "#/lib/use-dashboard-layout-access";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading } = useDashboardLayoutAccess(isAdminDashboardRole);

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
        messagingPath={APP_PATHS.admin.messaging}
        conversationSearchParam
      />
      <Outlet />
    </AdminAppShell>
  );
}

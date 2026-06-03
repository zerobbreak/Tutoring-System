import { createFileRoute, Outlet } from "@tanstack/react-router";
import { IncomingMessagesListener } from "#/components/messaging/incoming-messages-listener";
import { LecturerAppShell } from "#/components/lecturer-app-shell";
import { ScrollArea } from "#/components/ui/scroll-area";
import { APP_PATHS } from "#/lib/app-paths";
import { isLecturerDashboardRole } from "#/lib/user-role";
import { useDashboardLayoutAccess } from "#/lib/use-dashboard-layout-access";

export const Route = createFileRoute("/lecturer")({
  component: LecturerLayout,
});

function LecturerLayout() {
  const { user, loading } = useDashboardLayoutAccess(isLecturerDashboardRole);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--lagoon-deep) border-t-transparent" />
      </div>
    );
  }

  return (
    <LecturerAppShell user={user}>
      <IncomingMessagesListener
        messagingPath={APP_PATHS.lecturer.messages}
        conversationSearchParam
      />
      <ScrollArea className="min-h-0 flex-1">
        <Outlet />
      </ScrollArea>
    </LecturerAppShell>
  );
}

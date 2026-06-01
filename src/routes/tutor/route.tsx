import { createFileRoute, Outlet } from "@tanstack/react-router"
import { IncomingMessagesListener } from "#/components/messaging/incoming-messages-listener"
import { TutorAppShell } from "#/components/tutor-app-shell"
import { isTutorDashboardRole } from "#/lib/user-role"
import { useDashboardLayoutAccess } from "#/lib/use-dashboard-layout-access"

export const Route = createFileRoute("/tutor")({
  component: TutorLayout,
})

function TutorLayout() {
  const { user, loading } = useDashboardLayoutAccess(isTutorDashboardRole)

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--lagoon-deep)] border-t-transparent" />
      </div>
    )
  }

  return (
    <TutorAppShell user={user}>
      <IncomingMessagesListener messagingPath="/tutor/messaging" />
      <Outlet />
    </TutorAppShell>
  )
}

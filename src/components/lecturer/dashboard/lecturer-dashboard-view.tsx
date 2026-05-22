import { DashboardKpiCards } from "./dashboard-kpi-cards";
import { AttendanceAlertsPanel } from "./attendance-alerts-panel";
import { ModulesListPanel } from "./modules-list-panel";
import { PendingVerificationPanel } from "./pending-verification-panel";
import { QuickActionsPanel } from "./quick-actions-panel";
import { NotificationsInboxCard } from "#/components/notifications/notifications-inbox-card";
import { TutorActivityPanel } from "./tutor-activity-panel";
import type { LecturerDashboardViewProps } from "./types";
import { WeeklySessionsPanel } from "./weekly-sessions-panel";

export function LecturerDashboardView({
  user,
  booting,
  loadError,
  modulesCount,
  pendingVerificationCount,
  sessionsThisWeek,
  hoursThisWeek,
  modules,
  pendingClaims,
  recentClaims,
  attendanceAlerts,
  activityFeed,
  weekStart,
  weekEnd,
}: LecturerDashboardViewProps) {
  const displayName =
    user.user_metadata?.full_name || user.email || "Lecturer";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Welcome back,{" "}
          <span className="font-medium text-foreground">{displayName}</span>.
          Review tutor session claims for your modules.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      <DashboardKpiCards
        booting={booting}
        modulesCount={modulesCount}
        pendingVerificationCount={pendingVerificationCount}
        sessionsThisWeek={sessionsThisWeek}
        hoursThisWeek={hoursThisWeek}
        weekStart={weekStart}
        weekEnd={weekEnd}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickActionsPanel />
        <AttendanceAlertsPanel booting={booting} alerts={attendanceAlerts} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PendingVerificationPanel
          booting={booting}
          pendingVerificationCount={pendingVerificationCount}
          pendingClaims={pendingClaims}
        />
        <TutorActivityPanel booting={booting} activityFeed={activityFeed} />
        <NotificationsInboxCard
          sessionsLink="/lecturer/sessions"
          title="Notifications"
          description="Schedule changes and claim updates"
        />
      </div>

      <WeeklySessionsPanel booting={booting} recentClaims={recentClaims} />

      <ModulesListPanel booting={booting} modules={modules} />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TutorDashboardView } from "#/components/tutor/dashboard/tutor-dashboard-view";
import { useSessionUser } from "#/lib/use-session-user";
import type { SessionDayPoint } from "#/components/tutor-sessions-activity-chart";
import type { ScheduleParsedEvent } from "#/lib/schedule-spreadsheet";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import {
  getTutorDashboardDataFn,
  type DashboardClaimDTO,
  type DashboardNotificationDTO,
} from "#/server-actions/tutor-dashboard";

export const Route = createFileRoute("/tutor/")({
  component: TutorDashboard,
});

function TutorDashboard() {
  const { user, pending } = useSessionUser();

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeStudents, setActiveStudents] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [hoursThisWeek, setHoursThisWeek] = useState(0);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [coverageGapCount, setCoverageGapCount] = useState(0);
  const [claims, setClaims] = useState<DashboardClaimDTO[]>([]);
  const [chartSeries, setChartSeries] = useState<SessionDayPoint[] | null>(null);
  const [notifications, setNotifications] = useState<DashboardNotificationDTO[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleParsedEvent[]>([]);
  const [pendingPreviewClaims, setPendingPreviewClaims] = useState<DashboardClaimDTO[]>([]);
  const [hourBudget, setHourBudget] = useState<TutorHourBudgetSummary | null>(null);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setBooting(true);
      setLoadError(null);
      try {
        const data = await getTutorDashboardDataFn();
        if (cancelled) return;
        setActiveStudents(data.activeStudentsCount);
        setSessionsThisWeek(data.sessionsThisWeek);
        setHoursThisWeek(data.hoursThisWeek);
        setPendingClaimsCount(data.pendingClaimsCount);
        setCoverageGapCount(data.coverageGapCount);
        setClaims(data.claims);
        setChartSeries(data.chartSeries);
        setPendingPreviewClaims(data.pendingPreviewClaims);
        setUpcomingEvents(data.upcomingEvents);
        setNotifications(data.notifications);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (pending || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <TutorDashboardView
      user={user}
      booting={booting}
      loadError={loadError}
      activeStudents={activeStudents}
      sessionsThisWeek={sessionsThisWeek}
      hoursThisWeek={hoursThisWeek}
      pendingClaimsCount={pendingClaimsCount}
      coverageGapCount={coverageGapCount}
      claims={claims}
      chartSeries={chartSeries}
      pendingPreviewClaims={pendingPreviewClaims}
      upcomingEvents={upcomingEvents}
      notifications={notifications}
      hourBudget={hourBudget}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LecturerDashboardView } from "#/components/lecturer/dashboard/lecturer-dashboard-view";
import { useSessionUser } from "#/lib/use-session-user";
import {
  getLecturerDashboardDataFn,
  type LecturerActivityItemDTO,
  type LecturerAttendanceAlertDTO,
  type LecturerClaimDTO,
  type LecturerModuleDTO,
  type LecturerPendingClaimDTO,
} from "#/server-actions/lecturer-dashboard";

export const Route = createFileRoute("/lecturer/")({
  component: LecturerDashboard,
});

function LecturerDashboard() {
  const { user, pending } = useSessionUser();

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modulesCount, setModulesCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [hoursThisWeek, setHoursThisWeek] = useState(0);
  const [modules, setModules] = useState<LecturerModuleDTO[]>([]);
  const [pendingClaims, setPendingClaims] = useState<LecturerPendingClaimDTO[]>(
    [],
  );
  const [recentClaims, setRecentClaims] = useState<LecturerClaimDTO[]>([]);
  const [attendanceAlerts, setAttendanceAlerts] = useState<
    LecturerAttendanceAlertDTO[]
  >([]);
  const [activityFeed, setActivityFeed] = useState<LecturerActivityItemDTO[]>(
    [],
  );
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");

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
        const data = await getLecturerDashboardDataFn();
        if (cancelled) return;
        setModulesCount(data.modulesCount);
        setPendingVerificationCount(data.pendingVerificationCount);
        setSessionsThisWeek(data.sessionsThisWeek);
        setHoursThisWeek(data.hoursThisWeek);
        setModules(data.modules);
        setPendingClaims(data.pendingClaims);
        setRecentClaims(data.recentClaims);
        setAttendanceAlerts(data.attendanceAlerts);
        setActivityFeed(data.activityFeed);
        setWeekStart(data.weekStart);
        setWeekEnd(data.weekEnd);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load dashboard",
          );
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
    <LecturerDashboardView
      user={user}
      booting={booting}
      loadError={loadError}
      modulesCount={modulesCount}
      pendingVerificationCount={pendingVerificationCount}
      sessionsThisWeek={sessionsThisWeek}
      hoursThisWeek={hoursThisWeek}
      modules={modules}
      pendingClaims={pendingClaims}
      recentClaims={recentClaims}
      attendanceAlerts={attendanceAlerts}
      activityFeed={activityFeed}
      weekStart={weekStart}
      weekEnd={weekEnd}
    />
  );
}

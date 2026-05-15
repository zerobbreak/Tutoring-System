import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LecturerDashboardView } from "#/components/lecturer/dashboard/lecturer-dashboard-view";
import {
  getLecturerDashboardDataFn,
  type LecturerClaimDTO,
  type LecturerModuleDTO,
} from "#/server-actions/lecturer-dashboard";

const rootRouteApi = getRouteApi("__root__");

export const Route = createFileRoute("/lecturer/")({
  component: LecturerDashboard,
});

function LecturerDashboard() {
  const { sessionData } = rootRouteApi.useLoaderData();
  const user = sessionData?.user;

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modulesCount, setModulesCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [hoursThisWeek, setHoursThisWeek] = useState(0);
  const [modules, setModules] = useState<LecturerModuleDTO[]>([]);
  const [pendingClaims, setPendingClaims] = useState<LecturerClaimDTO[]>([]);
  const [recentClaims, setRecentClaims] = useState<LecturerClaimDTO[]>([]);
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

  if (!user) {
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
      weekStart={weekStart}
      weekEnd={weekEnd}
    />
  );
}

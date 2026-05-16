import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminDashboardView } from "#/components/admin/dashboard/admin-dashboard-view";
import {
  getAdminDashboardDataFn,
  type AdminAnalyticsSummaryDTO,
  type AdminDeadlineDTO,
  type AdminLecturerActivityDTO,
  type AdminPipelineDTO,
} from "#/server-actions/admin-dashboard";
import type { LecturerActivityItemDTO } from "#/server-actions/lecturer-dashboard";

const rootRouteApi = getRouteApi("__root__");

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { sessionData } = rootRouteApi.useLoaderData();
  const user = sessionData?.user;

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [verifiedClaimsCount, setVerifiedClaimsCount] = useState(0);
  const [activeSessionsCount, setActiveSessionsCount] = useState(0);
  const [approvedHours, setApprovedHours] = useState(0);
  const [pipeline, setPipeline] = useState<AdminPipelineDTO>({
    pendingLecturerVerifications: 0,
    pendingAdminApprovals: 0,
    openDisputes: 0,
    stalledClaims: 0,
    pendingScheduleChanges: 0,
  });
  const [activityFeed, setActivityFeed] = useState<LecturerActivityItemDTO[]>(
    [],
  );
  const [lecturerActivity, setLecturerActivity] = useState<
    AdminLecturerActivityDTO[]
  >([]);
  const [deadlines, setDeadlines] = useState<AdminDeadlineDTO[]>([]);
  const [analyticsSummary, setAnalyticsSummary] =
    useState<AdminAnalyticsSummaryDTO>({
      totalModules: 0,
      totalTutors: 0,
      activeTutors: 0,
      totalLecturers: 0,
      claimsPending: 0,
      claimsVerified: 0,
      claimsApproved: 0,
      openDisputes: 0,
    });
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
        const data = await getAdminDashboardDataFn();
        if (cancelled) return;
        setInstitutionName(data.institutionName);
        setPendingApprovalsCount(data.pendingApprovalsCount);
        setVerifiedClaimsCount(data.verifiedClaimsCount);
        setActiveSessionsCount(data.activeSessionsCount);
        setApprovedHours(data.approvedHours);
        setPipeline(data.pipeline);
        setActivityFeed(data.activityFeed);
        setLecturerActivity(data.lecturerActivity);
        setDeadlines(data.deadlines);
        setAnalyticsSummary(data.analyticsSummary);
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
    <AdminDashboardView
      user={user}
      booting={booting}
      loadError={loadError}
      institutionName={institutionName}
      pendingApprovalsCount={pendingApprovalsCount}
      verifiedClaimsCount={verifiedClaimsCount}
      activeSessionsCount={activeSessionsCount}
      approvedHours={approvedHours}
      pipeline={pipeline}
      activityFeed={activityFeed}
      lecturerActivity={lecturerActivity}
      deadlines={deadlines}
      analyticsSummary={analyticsSummary}
      weekStart={weekStart}
      weekEnd={weekEnd}
    />
  );
}

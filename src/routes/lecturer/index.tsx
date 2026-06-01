import { createFileRoute } from "@tanstack/react-router";
import { LecturerDashboardView } from "#/components/lecturer/dashboard/lecturer-dashboard-view";
import { useLecturerDashboardData } from "#/components/lecturer/dashboard/use-lecturer-dashboard-data";
import { useSessionUser } from "#/lib/use-session-user";
import { queryKeys } from "#/lib/query-keys";
import { getLecturerDashboardDataFn } from "#/server-actions/lecturer-dashboard";

export const Route = createFileRoute("/lecturer/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: queryKeys.lecturer.dashboard,
      queryFn: () => getLecturerDashboardDataFn(),
    }),
  component: LecturerDashboard,
});

function LecturerDashboard() {
  const { user, pending } = useSessionUser();
  const { data, isLoading, error } = useLecturerDashboardData(!!user);

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
      booting={isLoading}
      loadError={error instanceof Error ? error.message : null}
      modulesCount={data?.modulesCount ?? 0}
      pendingVerificationCount={data?.pendingVerificationCount ?? 0}
      sessionsThisWeek={data?.sessionsThisWeek ?? 0}
      hoursThisWeek={data?.hoursThisWeek ?? 0}
      modules={data?.modules ?? []}
      pendingClaims={data?.pendingClaims ?? []}
      recentClaims={data?.recentClaims ?? []}
      attendanceAlerts={data?.attendanceAlerts ?? []}
      activityFeed={data?.activityFeed ?? []}
      weekStart={data?.weekStart ?? ""}
      weekEnd={data?.weekEnd ?? ""}
    />
  );
}

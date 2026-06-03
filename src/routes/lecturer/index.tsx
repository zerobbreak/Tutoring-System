import { createFileRoute } from "@tanstack/react-router";
import { LecturerDashboardView } from "#/components/lecturer/dashboard/lecturer-dashboard-view";
import { useLecturerDashboardData } from "#/components/lecturer/dashboard/use-lecturer-dashboard-data";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { queryKeys } from "#/lib/query-keys";
import { useSessionUser } from "#/lib/use-session-user";
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
  const {
    data,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
  } = useLecturerDashboardData(!!user);
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

  return (
    <QueryPageGate
      sessionPending={pending || !user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading dashboard…"
    >
      <LecturerDashboardView
        user={user!}
        booting={isLoading}
        {...feedback}
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
    </QueryPageGate>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { TutorDashboardView } from "#/components/tutor/dashboard/tutor-dashboard-view";
import { useTutorDashboardData } from "#/components/tutor/dashboard/use-tutor-dashboard-data";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { queryKeys } from "#/lib/query-keys";
import { useSessionUser } from "#/lib/use-session-user";
import { getTutorDashboardDataFn } from "#/server-actions/tutor-dashboard";

export const Route = createFileRoute("/tutor/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: queryKeys.tutor.dashboard,
      queryFn: () => getTutorDashboardDataFn(),
    }),
  component: TutorDashboard,
});

function TutorDashboard() {
  const { user, pending } = useSessionUser();
  const {
    data,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
  } = useTutorDashboardData(!!user);
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
      <TutorDashboardView
        user={user!}
        booting={isLoading}
        {...feedback}
        activeStudents={data?.activeStudentsCount ?? 0}
        sessionsThisWeek={data?.sessionsThisWeek ?? 0}
        hoursThisWeek={data?.hoursThisWeek ?? 0}
        pendingClaimsCount={data?.pendingClaimsCount ?? 0}
        coverageGapCount={data?.coverageGapCount ?? 0}
        claims={data?.claims ?? []}
        chartSeries={data?.chartSeries ?? null}
        pendingPreviewClaims={data?.pendingPreviewClaims ?? []}
        upcomingEvents={data?.upcomingEvents ?? []}
        notifications={data?.notifications ?? []}
        hourBudget={null}
      />
    </QueryPageGate>
  );
}

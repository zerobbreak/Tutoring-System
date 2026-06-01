import { createFileRoute } from "@tanstack/react-router";
import { TutorDashboardView } from "#/components/tutor/dashboard/tutor-dashboard-view";
import { useTutorDashboardData } from "#/components/tutor/dashboard/use-tutor-dashboard-data";
import { useSessionUser } from "#/lib/use-session-user";
import { queryKeys } from "#/lib/query-keys";
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
  const { data, isLoading, error } = useTutorDashboardData(!!user);

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
      booting={isLoading}
      loadError={error instanceof Error ? error.message : null}
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
  );
}

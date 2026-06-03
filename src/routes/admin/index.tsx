import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboardView } from "#/components/admin/dashboard/admin-dashboard-view";
import { useAdminDashboardData } from "#/components/admin/dashboard/use-admin-dashboard-data";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { queryKeys } from "#/lib/query-keys";
import { useSessionUser } from "#/lib/use-session-user";
import { getAdminDashboardDataFn } from "#/server-actions/admin-dashboard";

export const Route = createFileRoute("/admin/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: queryKeys.admin.dashboard,
      queryFn: () => getAdminDashboardDataFn(),
    }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { user, pending } = useSessionUser();
  const {
    data,
    isLoading,
    isFetching,
    isSuccess,
    error,
    invalidate,
    refetch,
  } = useAdminDashboardData(!!user);
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
      <AdminDashboardView
        user={user!}
        booting={isLoading}
        {...feedback}
        institutionName={data?.institutionName ?? null}
        pendingApprovalsCount={data?.pendingApprovalsCount ?? 0}
        verifiedClaimsCount={data?.verifiedClaimsCount ?? 0}
        activeSessionsCount={data?.activeSessionsCount ?? 0}
        approvedHours={data?.approvedHours ?? 0}
        pipeline={
          data?.pipeline ?? {
            pendingLecturerVerifications: 0,
            pendingAdminApprovals: 0,
            openDisputes: 0,
            stalledClaims: 0,
            pendingScheduleChanges: 0,
            pendingTutorSessionCreations: 0,
          }
        }
        activityFeed={data?.activityFeed ?? []}
        lecturerActivity={data?.lecturerActivity ?? []}
        deadlines={data?.deadlines ?? []}
        analyticsSummary={
          data?.analyticsSummary ?? {
            totalModules: 0,
            totalTutors: 0,
            activeTutors: 0,
            totalLecturers: 0,
            claimsPending: 0,
            claimsVerified: 0,
            claimsApproved: 0,
            openDisputes: 0,
          }
        }
        weekStart={data?.weekStart ?? ""}
        weekEnd={data?.weekEnd ?? ""}
        pendingTutorSessionCreations={data?.pendingTutorSessionCreations ?? []}
        onTutorSessionApprovalsChanged={() => {
          void invalidate();
        }}
      />
    </QueryPageGate>
  );
}

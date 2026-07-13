import { createFileRoute } from "@tanstack/react-router";
import { AdminVenuesView } from "#/components/admin/venues/admin-venues-view";
import { useAdminVenuesData } from "#/components/admin/venues/use-admin-venues-data";
import { useAdminInstitutionsData } from "#/components/admin/institutions/use-admin-institutions-data";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { useSessionUser } from "#/lib/use-session-user";

export const Route = createFileRoute("/admin/venues")({
  component: AdminVenuesPage,
});

function AdminVenuesPage() {
  const { user, pending } = useSessionUser();

  const {
    venues,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
    invalidate,
  } = useAdminVenuesData({ enabled: !!user });

  const { campuses } = useAdminInstitutionsData({ enabled: !!user });

  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

  return (
    <QueryPageGate
      sessionPending={pending || !user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading venues…"
    >
      <AdminVenuesView
        venues={venues}
        campuses={campuses}
        loadError={feedback.loadError}
        onRetryLoad={feedback.onRetryLoad}
        retryingLoad={feedback.retryingLoad}
        onRefresh={() => void invalidate()}
      />
    </QueryPageGate>
  );
}

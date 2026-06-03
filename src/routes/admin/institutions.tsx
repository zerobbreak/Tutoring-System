import { createFileRoute } from "@tanstack/react-router";
import { InstitutionManagementView } from "#/components/admin/institutions/institution-management-view";
import { useAdminInstitutionsData } from "#/components/admin/institutions/use-admin-institutions-data";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { useSessionUser } from "#/lib/use-session-user";

export const Route = createFileRoute("/admin/institutions")({
  component: AdminInstitutionsPage,
});

function AdminInstitutionsPage() {
  const { user, pending } = useSessionUser();

  const {
    institution,
    campuses,
    academicTerms,
    modules,
    lecturers,
    dashboard,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
    invalidate,
  } = useAdminInstitutionsData({ enabled: !!user });
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

  return (
    <QueryPageGate
      sessionPending={pending || !user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading institution…"
    >
      <InstitutionManagementView
        user={user!}
        booting={isLoading}
        {...feedback}
        institution={institution}
        campuses={campuses}
        academicTerms={academicTerms}
        modules={modules}
        lecturers={lecturers}
        dashboard={dashboard}
        onRefresh={invalidate}
      />
    </QueryPageGate>
  );
}

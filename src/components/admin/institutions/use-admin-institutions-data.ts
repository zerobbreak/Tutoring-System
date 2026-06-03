import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getInstitutionManagementFn } from "#/server-actions/admin-institutions";

type UseAdminInstitutionsDataOptions = {
  enabled: boolean;
};

export function useAdminInstitutionsData({
  enabled,
}: UseAdminInstitutionsDataOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.institutions,
    queryFn: () => getInstitutionManagementFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.institutions });

  return {
    institution: query.data?.institution ?? null,
    campuses: query.data?.campuses ?? [],
    academicTerms: query.data?.academicTerms ?? [],
    modules: query.data?.modules ?? [],
    lecturers: query.data?.lecturers ?? [],
    dashboard: query.data?.dashboard ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

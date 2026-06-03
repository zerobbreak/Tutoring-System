import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getAdminReportsPageDataFn } from "#/server-actions/admin-reports";

export function useAdminReportsPageData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.reportsPage,
    queryFn: () => getAdminReportsPageDataFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.reportsPage });

  return { ...query, invalidate };
}

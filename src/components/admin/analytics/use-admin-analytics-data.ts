import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getAdminAnalyticsFn } from "#/server-actions/admin-analytics";

export function useAdminAnalyticsData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.analytics,
    queryFn: () => getAdminAnalyticsFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.analytics });

  return { ...query, invalidate };
}

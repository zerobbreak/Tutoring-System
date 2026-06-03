import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getAdminDashboardDataFn } from "#/server-actions/admin-dashboard";

export function useAdminDashboardData(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.dashboard,
    queryFn: () => getAdminDashboardDataFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard });

  return { ...query, invalidate };
}

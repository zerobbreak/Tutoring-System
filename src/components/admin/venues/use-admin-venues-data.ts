import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getAdminVenuesFn } from "#/server-actions/admin-venues";

type UseAdminVenuesDataOptions = {
  enabled: boolean;
};

export function useAdminVenuesData({ enabled }: UseAdminVenuesDataOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.venues,
    queryFn: () => getAdminVenuesFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.venues });

  return {
    venues: query.data?.venues ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

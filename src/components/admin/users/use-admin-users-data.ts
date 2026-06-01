import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  listAdminUsersFn,
  type AdminUserCategory,
} from "#/server-actions/admin-users";

type UseAdminUsersDataOptions = {
  enabled: boolean;
  category: AdminUserCategory;
  debouncedSearch: string;
};

export function useAdminUsersData({
  enabled,
  category,
  debouncedSearch,
}: UseAdminUsersDataOptions) {
  const queryClient = useQueryClient();
  const search = debouncedSearch || undefined;

  const query = useQuery({
    queryKey: queryKeys.admin.users({ category, search }),
    queryFn: () =>
      listAdminUsersFn({
        data: { category, search },
      }),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });

  return {
    users: query.data?.users ?? [],
    isLoading: query.isLoading,
    error: query.error,
    invalidate,
  };
}

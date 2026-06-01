import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  listVerificationQueueFn,
  type VerificationClaimCardDTO,
  type VerificationModuleOptionDTO,
} from "#/server-actions/lecturer-verification";

type UseVerificationQueueDataOptions = {
  enabled: boolean;
  debouncedSearch: string;
  moduleId: string;
};

const emptyQueue = {
  modules: [] as VerificationModuleOptionDTO[],
  pending: [] as VerificationClaimCardDTO[],
  disputed: [] as VerificationClaimCardDTO[],
  recentlyVerified: [] as VerificationClaimCardDTO[],
};

export function useVerificationQueueData({
  enabled,
  debouncedSearch,
  moduleId,
}: UseVerificationQueueDataOptions) {
  const queryClient = useQueryClient();
  const search = debouncedSearch || undefined;
  const moduleFilter = moduleId || undefined;

  const query = useQuery({
    queryKey: queryKeys.lecturer.verificationQueue({
      search,
      moduleId: moduleFilter,
    }),
    queryFn: () =>
      listVerificationQueueFn({
        data: { search, moduleId: moduleFilter },
      }),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.all });

  const result = query.data ?? emptyQueue;

  return {
    modules: result.modules,
    pending: result.pending,
    disputed: result.disputed,
    recentlyVerified: result.recentlyVerified,
    isLoading: query.isLoading,
    error: query.error,
    invalidate,
  };
}

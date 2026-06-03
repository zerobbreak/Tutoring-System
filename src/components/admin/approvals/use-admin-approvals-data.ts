import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  listApprovalsQueueFn,
  type AdminApprovalClaimCardDTO,
  type VerificationModuleOptionDTO,
} from "#/server-actions/admin-approvals";

type UseAdminApprovalsDataOptions = {
  enabled: boolean;
  debouncedSearch: string;
  moduleId: string;
};

const emptyQueue = {
  modules: [] as VerificationModuleOptionDTO[],
  awaitingAdmin: [] as AdminApprovalClaimCardDTO[],
  disputed: [] as AdminApprovalClaimCardDTO[],
  recentlyApproved: [] as AdminApprovalClaimCardDTO[],
  escalated: [] as AdminApprovalClaimCardDTO[],
};

export function useAdminApprovalsData({
  enabled,
  debouncedSearch,
  moduleId,
}: UseAdminApprovalsDataOptions) {
  const queryClient = useQueryClient();
  const search = debouncedSearch || undefined;
  const moduleFilter = moduleId || undefined;

  const query = useQuery({
    queryKey: queryKeys.admin.approvals({ search, moduleId: moduleFilter }),
    queryFn: () =>
      listApprovalsQueueFn({
        data: { search, moduleId: moduleFilter },
      }),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });

  const result = query.data ?? emptyQueue;

  return {
    modules: result.modules,
    awaitingAdmin: result.awaitingAdmin,
    disputed: result.disputed,
    recentlyApproved: result.recentlyApproved,
    escalated: result.escalated,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

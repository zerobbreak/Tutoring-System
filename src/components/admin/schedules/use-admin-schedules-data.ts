import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  detectSchedulingIssuesFn,
  getAdminSchedulePageDataFn,
  type AdminScheduleCalendarScope,
  type SchedulingIssue,
} from "#/server-actions/admin-schedules";

type UseAdminSchedulesDataOptions = {
  enabled: boolean;
  from: string;
  to: string;
  academicTermId: string | null;
  scope: AdminScheduleCalendarScope;
  scopeEntityId: string | null;
};

export function useAdminSchedulesData({
  enabled,
  from,
  to,
  academicTermId,
  scope,
  scopeEntityId,
}: UseAdminSchedulesDataOptions) {
  const queryClient = useQueryClient();

  const pageQuery = useQuery({
    queryKey: queryKeys.admin.schedules({
      from,
      to,
      academicTermId,
      scope,
      scopeEntityId,
    }),
    queryFn: () =>
      getAdminSchedulePageDataFn({
        data: { from, to, academicTermId, scope, scopeEntityId },
      }),
    enabled,
  });

  const issuesQuery = useQuery({
    queryKey: queryKeys.admin.scheduleIssues({
      from,
      to,
      academicTermId,
      scope,
      scopeEntityId,
    }),
    queryFn: () =>
      detectSchedulingIssuesFn({
        data: { from, to, academicTermId, scope, scopeEntityId },
      }),
    enabled,
    select: (result) => result.issues as SchedulingIssue[],
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  };

  return {
    data: pageQuery.data ?? null,
    issues: issuesQuery.data ?? [],
    isLoading: pageQuery.isLoading,
    issuesLoading: issuesQuery.isLoading,
    error: pageQuery.error,
    invalidate,
  };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  listAuditLogFeedFn,
  type AuditFeedCategory,
} from "#/server-actions/admin-audit-logs";
import { listAdminUsersFn } from "#/server-actions/admin-users";

export type AdminAuditLogFilters = {
  category: AuditFeedCategory;
  actorId: string | null;
  moduleId: string | null;
  dateFrom: string;
  dateTo: string;
};

function dateInputToIsoStart(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function dateInputToIsoEnd(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

type UseAdminAuditLogsDataOptions = {
  enabled: boolean;
  filters: AdminAuditLogFilters;
};

export function useAdminAuditLogsData({
  enabled,
  filters,
}: UseAdminAuditLogsDataOptions) {
  const queryClient = useQueryClient();
  const from = dateInputToIsoStart(filters.dateFrom);
  const to = dateInputToIsoEnd(filters.dateTo);

  const feedQueryKey = queryKeys.admin.auditLogs({
    category: filters.category,
    actorId: filters.actorId,
    moduleId: filters.moduleId,
    from,
    to,
  });

  const actorsQuery = useQuery({
    queryKey: queryKeys.admin.auditLogActors,
    queryFn: () => listAdminUsersFn({ data: { category: "all" } }),
    enabled,
    select: (res) => res.users,
  });

  const feedQuery = useQuery({
    queryKey: feedQueryKey,
    queryFn: () =>
      listAuditLogFeedFn({
        data: {
          category: filters.category,
          actorId: filters.actorId ?? undefined,
          moduleId: filters.moduleId ?? undefined,
          from,
          to,
        },
      }),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["admin", "audit-logs"],
    });

  return {
    users: actorsQuery.data ?? [],
    data: feedQuery.data ?? null,
    isLoading: feedQuery.isLoading,
    isFetching: feedQuery.isFetching,
    isSuccess: feedQuery.isSuccess,
    error: feedQuery.error,
    refetch: feedQuery.refetch,
    invalidate,
  };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { listAdminSessionsFn } from "#/server-actions/admin-sessions";

type UseAdminSessionsDataOptions = {
  enabled: boolean;
  lookbackDays: number;
  moduleId: string | null;
  tutorId: string | null;
  lecturerId: string | null;
};

export function useAdminSessionsData({
  enabled,
  lookbackDays,
  moduleId,
  tutorId,
  lecturerId,
}: UseAdminSessionsDataOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.sessions({
      lookbackDays,
      moduleId: moduleId ?? undefined,
      tutorId: tutorId ?? undefined,
      lecturerId: lecturerId ?? undefined,
    }),
    queryFn: () =>
      listAdminSessionsFn({
        data: {
          lookbackDays,
          moduleId: moduleId ?? undefined,
          tutorId: tutorId ?? undefined,
          lecturerId: lecturerId ?? undefined,
        },
      }),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    invalidate,
  };
}

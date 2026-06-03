import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getLecturerReportsPageDataFn } from "#/server-actions/lecturer-reports";

export function useLecturerReportsPageData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.lecturer.reportsPage,
    queryFn: () => getLecturerReportsPageDataFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.reportsPage });

  return { ...query, invalidate };
}

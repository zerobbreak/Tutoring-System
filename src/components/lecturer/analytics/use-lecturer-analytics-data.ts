import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getLecturerAnalyticsFn } from "#/server-actions/lecturer-analytics";

export function useLecturerAnalyticsData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.lecturer.analytics,
    queryFn: () => getLecturerAnalyticsFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.analytics });

  return { ...query, invalidate };
}

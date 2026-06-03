import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getLecturerSchedulePageDataFn } from "#/server-actions/lecturer-schedule";

type UseLecturerScheduleDataOptions = {
  enabled: boolean;
  from: string;
  to: string;
};

export function useLecturerScheduleData({
  enabled,
  from,
  to,
}: UseLecturerScheduleDataOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.lecturer.schedule({ from, to }),
    queryFn: () => getLecturerSchedulePageDataFn({ data: { from, to } }),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.all });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
}

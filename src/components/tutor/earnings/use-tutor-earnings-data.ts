import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getTutorEarningsFn } from "#/server-actions/tutor-earnings";

export function useTutorEarningsData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tutor.earnings,
    queryFn: () => getTutorEarningsFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.tutor.earnings });

  return { ...query, invalidate };
}

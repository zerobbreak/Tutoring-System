import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { listLecturerSessionsFn } from "#/server-actions/lecturer-sessions";

export function useLecturerSessionsData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.lecturer.sessions,
    queryFn: () => listLecturerSessionsFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.sessions });

  return { ...query, invalidate };
}

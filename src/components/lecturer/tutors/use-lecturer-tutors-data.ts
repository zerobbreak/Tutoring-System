import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { listLecturerTutorsFn } from "#/server-actions/lecturer-tutors";

export function useLecturerTutorsData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.lecturer.tutors,
    queryFn: () => listLecturerTutorsFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.tutors });

  return { ...query, invalidate };
}

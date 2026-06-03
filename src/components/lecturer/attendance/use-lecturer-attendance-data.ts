import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getAttendanceDashboardFn } from "#/server-actions/lecturer-attendance";

export function useLecturerAttendanceData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.lecturer.attendance,
    queryFn: () => getAttendanceDashboardFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.lecturer.attendance });

  return { ...query, invalidate };
}

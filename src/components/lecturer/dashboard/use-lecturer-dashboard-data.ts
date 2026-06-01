import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getLecturerDashboardDataFn } from "#/server-actions/lecturer-dashboard";

export function useLecturerDashboardData(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.lecturer.dashboard,
    queryFn: () => getLecturerDashboardDataFn(),
    enabled,
  });
}

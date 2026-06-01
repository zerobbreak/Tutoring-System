import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getTutorDashboardDataFn } from "#/server-actions/tutor-dashboard";

export function useTutorDashboardData(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tutor.dashboard,
    queryFn: () => getTutorDashboardDataFn(),
    enabled,
  });
}

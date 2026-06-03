import { addWeeks, endOfDay, startOfDay } from "date-fns";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "#/lib/toast";
import { queryKeys } from "#/lib/query-keys";
import {
  listTutorAssignedScheduleFn,
  type TutorAssignedScheduleEventDTO,
} from "#/server-actions/tutor-assigned-schedule";

export function useTutorAssignedSchedule() {
  const queryClient = useQueryClient();
  const range = useMemo(() => {
    const from = startOfDay(new Date());
    const to = endOfDay(addWeeks(from, 8));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, []);

  const query = useQuery({
    queryKey: queryKeys.tutor.assignedSchedule(range),
    queryFn: () =>
      listTutorAssignedScheduleFn({
        data: range,
      }),
  });

  useEffect(() => {
    if (query.error) {
      toast.error(
        query.error instanceof Error
          ? query.error.message
          : "Could not load assigned schedule",
      );
    }
  }, [query.error]);

  const reload = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.tutor.assignedSchedule(range),
    });

  return {
    events: (query.data?.events ?? []) as TutorAssignedScheduleEventDTO[],
    loading: query.isLoading,
    reload,
  };
}

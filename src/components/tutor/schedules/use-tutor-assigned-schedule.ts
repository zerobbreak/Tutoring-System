import { addWeeks, endOfDay, startOfDay } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { toast } from "#/lib/toast";
import {
  listTutorAssignedScheduleFn,
  type TutorAssignedScheduleEventDTO,
} from "#/server-actions/tutor-assigned-schedule";

export function useTutorAssignedSchedule() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TutorAssignedScheduleEventDTO[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfDay(new Date());
      const to = endOfDay(addWeeks(from, 8));
      const { events: list } = await listTutorAssignedScheduleFn({
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
      setEvents(list);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load assigned schedule",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, reload: load };
}

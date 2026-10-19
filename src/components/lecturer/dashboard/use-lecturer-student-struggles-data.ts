import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  listLecturerStudentStrugglesFn,
  markStudentStrugglesSeenFn,
} from "#/server-actions/lecturer-dashboard";

export function useLecturerStudentStrugglesData(moduleId: string | undefined) {
  const queryClient = useQueryClient();
  const filters = { moduleId };

  const query = useQuery({
    queryKey: queryKeys.lecturer.studentStruggles(filters),
    queryFn: () => listLecturerStudentStrugglesFn({ data: filters }),
  });

  const markSeen = async (claimId: string) => {
    await markStudentStrugglesSeenFn({ data: { claimId } });
    await queryClient.invalidateQueries({
      queryKey: ["lecturer", "student-struggles"],
    });
  };

  return { ...query, markSeen };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { listTutorNotesClaimsFn } from "#/server-actions/tutor-notes";

export function useTutorNotesData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tutor.notesClaims,
    queryFn: () => listTutorNotesClaimsFn(),
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.tutor.notesClaims });

  return { ...query, invalidate };
}

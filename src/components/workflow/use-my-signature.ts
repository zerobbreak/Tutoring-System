import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import { getMySignatureFn } from "#/server-actions/claim-signatures";

/** The signed-in user's saved signature (null when none is drawn yet). */
export function useMySignature(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.settings.signature,
    queryFn: () => getMySignatureFn(),
    enabled,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.signature });
  return { ...query, invalidate };
}

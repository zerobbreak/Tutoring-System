import { QueryClient } from "@tanstack/react-query";

const STALE_TIME_MS = 1000 * 60;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: 1,
      },
    },
  });
}

export function resetQueryCache(queryClient: QueryClient) {
  const activeQueries = queryClient.getQueryCache().findAll({
    fetchStatus: "fetching",
  });

  for (const query of activeQueries) {
    queryClient.getQueryCache().remove(query);
  }

  queryClient.invalidateQueries({ queryKey: ["auth"] });
}

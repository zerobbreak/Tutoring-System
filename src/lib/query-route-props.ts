import { formatQueryError } from "#/lib/query-error";

type QueryWithFeedback = {
  error: unknown;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

/** Standard loadError + retry props for query-backed feature views. */
export function queryLoadFeedbackProps(query: QueryWithFeedback) {
  return {
    loadError: formatQueryError(query.error),
    onRetryLoad: () => {
      void query.refetch();
    },
    retryingLoad: query.isFetching,
  };
}

import type { ReactNode } from "react";
import {
  PageLoadingSpinner,
  QueryBlockingState,
} from "#/components/ui/query-fetch-feedback";
import { formatQueryError } from "#/lib/query-error";

type QueryPageGateProps = {
  /** Session/auth still resolving. */
  sessionPending: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  hasData: boolean;
  onRetry: () => void;
  loadingLabel?: string;
  children: ReactNode;
};

/**
 * Route-level guard: spinner while session or first fetch runs;
 * blocking error when the query failed with no cached payload.
 */
export function QueryPageGate({
  sessionPending,
  isLoading,
  isFetching,
  error,
  hasData,
  onRetry,
  loadingLabel,
  children,
}: QueryPageGateProps) {
  if (sessionPending) {
    return <PageLoadingSpinner />;
  }

  if (isLoading && !hasData) {
    return <PageLoadingSpinner label={loadingLabel} />;
  }

  const loadError = formatQueryError(error);
  if (loadError && !hasData) {
    return (
      <QueryBlockingState
        title="Could not load this page"
        message={loadError}
        onRetry={onRetry}
        retrying={isFetching}
      />
    );
  }

  return <>{children}</>;
}

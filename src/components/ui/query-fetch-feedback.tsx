import { AlertCircle, Inbox, Loader2, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

type PageLoadingSpinnerProps = {
  label?: string;
  className?: string;
};

/** Centered spinner for session boot or first query fetch without cached data. */
export function PageLoadingSpinner({
  label = "Loading…",
  className,
}: PageLoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-3",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
        aria-hidden
      />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}

type QueryErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

/** Inline alert for failed queries; optional retry refetches the query. */
export function QueryErrorBanner({
  message,
  onRetry,
  retrying = false,
  className,
}: QueryErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex gap-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{message}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="size-3.5" aria-hidden />
          )}
          Try again
        </Button>
      ) : null}
    </div>
  );
}

type QueryBlockingStateProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Full-page fallback when the primary query has no cached data and failed or is still loading. */
export function QueryBlockingState({
  title,
  message,
  onRetry,
  retrying = false,
}: QueryBlockingStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertCircle className="size-10 text-destructive/80" aria-hidden />
      <div className="max-w-md space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="size-3.5" aria-hidden />
          )}
          Try again
        </Button>
      ) : null}
    </div>
  );
}

type QueryEmptyStateProps = {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

/** Consistent empty list / filter result placeholder. */
export function QueryEmptyState({
  title,
  description,
  action,
  className,
}: QueryEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center",
        className,
      )}
    >
      <Inbox className="size-8 text-muted-foreground/70" aria-hidden />
      {title ? (
        <p className="text-sm font-medium text-foreground">{title}</p>
      ) : null}
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

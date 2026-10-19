import { Link } from "@tanstack/react-router";
import { PenLine } from "lucide-react";
import { useEffect } from "react";
import { useMySignature } from "#/components/workflow/use-my-signature";
import { Skeleton } from "#/components/ui/skeleton";
import { APP_PATHS } from "#/lib/app-paths";

/**
 * Shows the saved signature that will be stamped on this claim step, or a
 * link to draw one. Reports readiness so the caller can block confirmation.
 */
export function SigningAs({
  onReadyChange,
}: {
  onReadyChange: (ready: boolean) => void;
}) {
  const { data, isLoading } = useMySignature();
  const ready = !isLoading && !!data;

  useEffect(() => {
    onReadyChange(ready);
  }, [ready, onReadyChange]);

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  if (!data) {
    return (
      <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
        <PenLine className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          You need a saved signature to sign claims.{" "}
          <Link to={APP_PATHS.settings} className="font-medium underline underline-offset-2">
            Draw it in Settings → Security
          </Link>
          , then come back.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Your signature will be added to this claim
      </p>
      <div className="flex h-20 items-center justify-center rounded-lg border bg-white px-3">
        <img
          src={data.imageDataUrl}
          alt="Your saved signature"
          className="max-h-16 max-w-full object-contain"
        />
      </div>
    </div>
  );
}

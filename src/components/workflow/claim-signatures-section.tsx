import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { AlertTriangle, PenLine, ShieldCheck } from "lucide-react";
import { Skeleton } from "#/components/ui/skeleton";
import { formatQueryError } from "#/lib/query-error";
import { queryKeys } from "#/lib/query-keys";
import { cn } from "#/lib/utils";
import { listClaimSignaturesFn } from "#/server-actions/claim-signatures";

const ROLE_LABEL = { TUTOR: "Tutor", LECTURER: "Lecturer", ADMIN: "Admin" } as const;

function stepLabel(actionType: string): string {
  switch (actionType) {
    case "SUBMITTED":
      return "Submitted";
    case "REOPENED":
      return "Reopened to fix";
    case "APPROVED":
      return "Verified";
    case "REJECTED":
    case "ADMIN_REJECTED":
      return "Rejected";
    case "DISPUTED":
      return "Disputed";
    case "ADMIN_APPROVED":
      return "Approved";
    case "CLARIFICATION_REQUESTED":
      return "Sent back for clarification";
    default:
      return actionType.replace(/_/g, " ").toLowerCase();
  }
}

/** Signatures recorded at each claim step, with a tamper check against current content. */
export function ClaimSignaturesSection({
  claimId,
  className,
}: {
  claimId: string;
  className?: string;
}) {
  const query = useQuery({
    queryKey: queryKeys.claimSignatures(claimId),
    queryFn: () => listClaimSignaturesFn({ data: { claimId } }),
  });

  return (
    <section
      className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-sm", className)}
      aria-labelledby={`signatures-${claimId}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <PenLine className="size-4 text-(--lagoon-deep)" aria-hidden />
        <h3 id={`signatures-${claimId}`} className="text-sm font-semibold">
          Signatures
        </h3>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : query.error ? (
        <p className="text-sm text-destructive">
          {formatQueryError(query.error) ?? "Could not load signatures."}
        </p>
      ) : !query.data?.length ? (
        <p className="text-sm text-muted-foreground">
          No signatures yet. Each step is signed when it happens.
        </p>
      ) : (
        <ul className="space-y-3">
          {query.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5">
              <div className="flex h-14 w-36 shrink-0 items-center justify-center rounded-md border bg-white px-2">
                <img
                  src={s.imageDataUrl}
                  alt={`Signature of ${s.signerName}`}
                  className="max-h-12 max-w-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-foreground">
                  {s.signerName}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {ROLE_LABEL[s.signerRole]} · {stepLabel(s.actionType)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(s.signedAt), "dd MMM yyyy, HH:mm")} · signed with
                  authenticator
                </p>
                {s.matchesCurrent ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    Claim unchanged since this signature
                  </p>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Claim edited after this signature
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

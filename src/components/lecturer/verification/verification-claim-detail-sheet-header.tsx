import { formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "#/components/ui/badge";
import { WorkflowMessageButton } from "#/components/messaging/workflow-message-button";
import { claimBadgeLabel, claimBadgeVariant } from "#/lib/session-claim-display";
import type { VerificationClaimDetailDTO } from "#/server-actions/lecturer-verification";
import type { ClaimStatus } from "#/lib/session-claim-display";

type VerificationClaimDetailSheetHeaderProps = {
  claim: VerificationClaimDetailDTO;
};

export function VerificationClaimDetailSheetHeader({ claim }: VerificationClaimDetailSheetHeaderProps) {
  return (
    <div className="shrink-0 border-b bg-linear-to-br from-(--lagoon-deep)/10 via-background to-background px-6 py-5">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">
          {claim.tutor?.full_name ?? "Tutor"}
        </h2>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{claim.module?.code}</span>
          {" — "}
          {claim.module?.name}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge variant={claimBadgeVariant(claim.status as ClaimStatus)}>
            {claimBadgeLabel(claim.status as ClaimStatus)}
          </Badge>
          {claim.submitted_at ? (
            <span className="text-xs text-muted-foreground">
              Submitted {formatDistanceToNow(parseISO(claim.submitted_at), { addSuffix: true })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <WorkflowMessageButton kind="claim" claimId={claim.id} />
        <WorkflowMessageButton kind="session" claimId={claim.id} />
        {claim.open_dispute ? (
          <WorkflowMessageButton kind="dispute" disputeId={claim.open_dispute.id} />
        ) : null}
      </div>
    </div>
  );
}

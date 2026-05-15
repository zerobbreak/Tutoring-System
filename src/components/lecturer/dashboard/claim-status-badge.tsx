import { Badge } from "#/components/ui/badge";
import { formatClaimStatus } from "#/lib/session-claim-display";
import type { LecturerClaimDTO } from "#/server-actions/lecturer-dashboard";

export function ClaimStatusBadge({
  status,
}: {
  status: LecturerClaimDTO["status"];
}) {
  const variant =
    status === "PENDING_VERIFICATION"
      ? "secondary"
      : status === "DISPUTED"
        ? "destructive"
        : "outline";
  return <Badge variant={variant}>{formatClaimStatus(status)}</Badge>;
}

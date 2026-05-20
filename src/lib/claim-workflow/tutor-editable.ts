import type { ClaimStatus } from "#/lib/session-claim-display";
import { TUTOR_EDITABLE_STATUSES } from "./transitions";

export function canTutorEditClaim(
  status: ClaimStatus,
  frozenAt: string | null | undefined,
): boolean {
  if (frozenAt) return false;
  return TUTOR_EDITABLE_STATUSES.includes(status);
}

export function canTutorReopenClaim(
  status: ClaimStatus,
  frozenAt: string | null | undefined,
): boolean {
  if (frozenAt) return false;
  return status === "REJECTED" || status === "DISPUTED";
}

import type { ClaimStatus } from "#/lib/session-claim-display";
import { TUTOR_EDITABLE_STATUSES } from "./transitions";

export function assertClaimNotFrozen(
  frozenAt: string | null | undefined,
  actionLabel = "modify this claim",
): void {
  if (frozenAt) {
    throw new Error(
      `This claim is frozen and cannot be updated. Unfreeze before you ${actionLabel}.`,
    );
  }
}

export function assertTutorCanEditClaim(
  status: ClaimStatus,
  frozenAt: string | null | undefined,
  actionLabel = "edit this session",
): void {
  assertClaimNotFrozen(frozenAt, actionLabel);
  if (!TUTOR_EDITABLE_STATUSES.includes(status)) {
    throw new Error(
      `This session cannot be ${actionLabel} while it is ${status.replace(/_/g, " ").toLowerCase()}.`,
    );
  }
}

export function assertStatusIn(
  status: ClaimStatus,
  allowed: ClaimStatus[],
  message: string,
): void {
  if (!allowed.includes(status)) {
    throw new Error(message.replace("{status}", status));
  }
}

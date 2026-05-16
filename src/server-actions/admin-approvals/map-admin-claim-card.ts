import { mapClaimCardRow } from "#/server-actions/lecturer-verification/map-claim-card";
import type { AdminApprovalClaimCardDTO } from "./types";

type RawRow = Parameters<typeof mapClaimCardRow>[0] & {
  frozen_at?: string | null;
};

export function mapAdminClaimCard(
  row: RawRow,
  evidenceCount: number,
  scanCount: number,
  lecturerVerified: boolean,
): AdminApprovalClaimCardDTO {
  const card = mapClaimCardRow(row, evidenceCount, scanCount);
  return {
    ...card,
    frozen_at: row.frozen_at ?? null,
    lecturer_verified:
      lecturerVerified || card.status === "VERIFIED" || card.status === "APPROVED",
  };
}

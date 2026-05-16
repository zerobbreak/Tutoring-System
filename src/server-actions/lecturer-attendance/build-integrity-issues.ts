import type { ClaimStatus } from "#/lib/session-claim-display";
import type { IntegrityIssueDTO } from "./types";

const REGISTER_STATUSES: readonly ClaimStatus[] = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "APPROVED",
];

type ClaimRow = {
  id: string;
  session_date: string;
  status: ClaimStatus;
  attendance_present_count: number | null;
  moduleCode: string;
};

export function buildIntegrityIssues(
  claims: ClaimRow[],
  scanCountByClaim: Map<string, number>,
  evidenceClaimIds: Set<string>,
  unverifiedByClaim: Map<string, number>,
): IntegrityIssueDTO[] {
  const issues: IntegrityIssueDTO[] = [];

  for (const row of claims) {
    const scans = scanCountByClaim.get(row.id) ?? 0;
    const present = row.attendance_present_count;

    if (present != null && present !== scans) {
      issues.push({
        id: `mismatch-${row.id}`,
        kind: "HEADCOUNT_MISMATCH",
        claimId: row.id,
        moduleCode: row.moduleCode,
        session_date: row.session_date,
        message: `${row.moduleCode} on ${row.session_date}: headcount (${present}) does not match QR scans (${scans}).`,
      });
    }

    if (
      REGISTER_STATUSES.includes(row.status) &&
      !evidenceClaimIds.has(row.id)
    ) {
      issues.push({
        id: `register-${row.id}`,
        kind: "MISSING_REGISTER",
        claimId: row.id,
        moduleCode: row.moduleCode,
        session_date: row.session_date,
        message: `${row.moduleCode} on ${row.session_date}: no attendance register uploaded.`,
      });
    }

    const unverified = unverifiedByClaim.get(row.id) ?? 0;
    if (unverified > 0) {
      issues.push({
        id: `unverified-${row.id}`,
        kind: "UNVERIFIED_SCANS",
        claimId: row.id,
        moduleCode: row.moduleCode,
        session_date: row.session_date,
        message: `${row.moduleCode} on ${row.session_date}: ${unverified} QR check-in${unverified === 1 ? "" : "s"} not verified.`,
      });
    }
  }

  return issues.slice(0, 20);
}

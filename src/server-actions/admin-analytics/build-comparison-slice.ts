import type { ClaimRow } from "#/server-actions/lecturer-analytics/helpers";
import type { ComparisonSliceDTO } from "./types";

export function buildComparisonSlice(
  id: string,
  label: string,
  claims: ClaimRow[],
  scheduledExpected: number,
  scheduledCompleted: number,
): ComparisonSliceDTO {
  let pendingCount = 0;
  const nonDraft = claims.filter((c) => c.status !== "DRAFT");

  for (const c of claims) {
    if (c.status === "PENDING_VERIFICATION") pendingCount += 1;
  }

  return {
    id,
    label,
    sessionCount: nonDraft.length,
    utilizationRate:
      scheduledExpected > 0
        ? Math.round((scheduledCompleted / scheduledExpected) * 100) / 100
        : null,
    pendingCount,
  };
}

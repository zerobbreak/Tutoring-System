import {
  differenceInHours,
  format,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import {
  APPROVE_ACTION_TYPES,
  APPROVE_TO_STATUSES,
  HEATMAP_WEEKS,
} from "./constants";

export type ClaimRow = {
  id: string;
  tutor_id: string;
  module_id: string;
  session_date: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  hours: number | string;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  source_scheduled_session_id: string | null;
};

export type VerificationActionRow = {
  claim_id: string;
  actor_id: string;
  action_type: string;
  to_status: string | null;
  acted_at: string;
};

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function claimAttendanceRate(claim: ClaimRow): number | null {
  const present = claim.attendance_present_count;
  const expected = claim.attendance_expected_count;
  if (present == null || expected == null || expected <= 0) return null;
  if (claim.status === "DRAFT") return null;
  return present / expected;
}

export function isApproveAction(action: VerificationActionRow): boolean {
  if (action.to_status && APPROVE_TO_STATUSES.has(action.to_status)) {
    return true;
  }
  return APPROVE_ACTION_TYPES.has(action.action_type);
}

export function turnaroundHours(
  submittedAt: string,
  approvedAt: string,
): number {
  const hours = differenceInHours(parseISO(approvedAt), parseISO(submittedAt));
  return Math.max(0, hours);
}

export function firstApproveByClaim(
  actions: VerificationActionRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  const sorted = [...actions].sort((a, b) =>
    a.acted_at.localeCompare(b.acted_at),
  );
  for (const action of sorted) {
    if (!isApproveAction(action)) continue;
    if (!map.has(action.claim_id)) {
      map.set(action.claim_id, action.acted_at);
    }
  }
  return map;
}

export function attendanceConsistencyScore(rates: number[]): number | null {
  if (rates.length < 2) return rates.length === 1 ? 1 : null;
  const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
  const variance =
    rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
  const stdDev = Math.sqrt(variance);
  return Math.max(0, Math.min(1, 1 - stdDev));
}

export function computePerformanceScore(input: {
  approvalRate: number | null;
  attendanceAverage: number | null;
  attendanceConsistency: number | null;
  disputeRate: number | null;
}): number | null {
  const parts: number[] = [];
  if (input.approvalRate != null) parts.push(input.approvalRate);
  if (input.attendanceAverage != null) parts.push(input.attendanceAverage);
  if (input.attendanceConsistency != null) {
    parts.push(input.attendanceConsistency);
  }
  if (input.disputeRate != null) {
    parts.push(Math.max(0, 1 - input.disputeRate * 5));
  }
  if (!parts.length) return null;
  return Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 100);
}

export function buildHeatmapWeekStarts(now: Date): string[] {
  const weeks: string[] = [];
  for (let i = HEATMAP_WEEKS - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    weeks.push(format(weekStart, "yyyy-MM-dd"));
  }
  return weeks;
}

export function weekKeyForDate(sessionDate: string, now: Date): string | null {
  const weeks = buildHeatmapWeekStarts(now);
  const d = parseISO(sessionDate);
  for (let i = weeks.length - 1; i >= 0; i--) {
    const start = parseISO(weeks[i]);
    const end =
      i < weeks.length - 1
        ? subDays(parseISO(weeks[i + 1]), 1)
        : now;
    if (d >= start && d <= end) return weeks[i];
  }
  return null;
}

export function parseHours(raw: number | string): number {
  const h = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
  return Number.isFinite(h) ? h : 0;
}

export function buildClaimsVolumeTrend(
  claims: ClaimRow[],
  lookbackDays: number,
  now: Date,
  firstApproveAt: Map<string, string>,
): { date: string; dateLabel: string; submitted: number; completed: number }[] {
  const byDate = new Map<string, { submitted: number; completed: number }>();

  for (let i = lookbackDays - 1; i >= 0; i--) {
    const key = format(subDays(now, i), "yyyy-MM-dd");
    byDate.set(key, { submitted: 0, completed: 0 });
  }

  for (const claim of claims) {
    if (claim.submitted_at) {
      const subKey = claim.submitted_at.slice(0, 10);
      if (byDate.has(subKey)) {
        const agg = byDate.get(subKey)!;
        agg.submitted += 1;
      }
    }
    const approvedAt = firstApproveAt.get(claim.id);
    if (approvedAt) {
      const doneKey = approvedAt.slice(0, 10);
      if (byDate.has(doneKey)) {
        const agg = byDate.get(doneKey)!;
        agg.completed += 1;
      }
    }
  }

  return [...byDate.entries()].map(([date, agg]) => ({
    date,
    dateLabel: format(parseISO(date), "MMM d"),
    submitted: agg.submitted,
    completed: agg.completed,
  }));
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  SIGNED_APPROVAL: "Signed approval",
  REJECTED: "Rejected",
  DISPUTED: "Disputed",
  CLARIFICATION_REQUESTED: "Clarification requested",
};

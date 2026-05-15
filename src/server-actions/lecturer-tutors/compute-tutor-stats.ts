import { subDays } from "date-fns";
import type { ClaimStatus } from "#/lib/session-claim-display";

const INACTIVE_DAYS = 30;

export type ClaimStatsRow = {
  id: string;
  tutor_id: string;
  status: ClaimStatus;
  submitted_at: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  hours: number | string;
  session_date: string;
  updated_at: string;
  source_scheduled_session_id: string | null;
};

export type TutorAggregateStats = {
  sessionsCompleted: number;
  pendingClaims: number;
  rejectedClaims: number;
  disputedClaims: number;
  approvalRate: number | null;
  attendanceAverage: number | null;
  totalHours: number;
  scheduleLinkedCount: number;
  nonDraftCount: number;
  lastActivityAt: string | null;
  recentClaimIds: string[];
};

export function computeTutorStats(
  claims: ClaimStatsRow[],
): TutorAggregateStats {
  let sessionsCompleted = 0;
  let pendingClaims = 0;
  let rejectedClaims = 0;
  let disputedClaims = 0;
  let submitted = 0;
  let approved = 0;
  let attendanceSum = 0;
  let attendanceCount = 0;
  let totalHours = 0;
  let scheduleLinkedCount = 0;
  let nonDraftCount = 0;
  let lastActivityAt: string | null = null;

  const sorted = [...claims].sort(
    (a, b) => b.updated_at.localeCompare(a.updated_at),
  );
  const recentClaimIds = sorted.slice(0, 5).map((c) => c.id);

  for (const c of claims) {
    if (c.status === "VERIFIED" || c.status === "APPROVED") {
      sessionsCompleted++;
    }
    if (c.status === "PENDING_VERIFICATION") pendingClaims++;
    if (c.status === "REJECTED") rejectedClaims++;
    if (c.status === "DISPUTED") disputedClaims++;

    if (c.status !== "DRAFT") nonDraftCount++;

    if (c.submitted_at) {
      submitted++;
      if (c.status === "VERIFIED" || c.status === "APPROVED") approved++;
    }

    const rawH = c.hours;
    const hours =
      typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);
    if (Number.isFinite(hours)) totalHours += hours;

    const present = c.attendance_present_count;
    const expected = c.attendance_expected_count;
    if (
      present != null &&
      expected != null &&
      expected > 0 &&
      c.status !== "DRAFT"
    ) {
      attendanceSum += present / expected;
      attendanceCount++;
    }

    if (c.source_scheduled_session_id && c.status !== "DRAFT") {
      scheduleLinkedCount++;
    }

    const activityAt = c.submitted_at ?? c.updated_at;
    if (!lastActivityAt || activityAt > lastActivityAt) {
      lastActivityAt = activityAt;
    }
  }

  return {
    sessionsCompleted,
    pendingClaims,
    rejectedClaims,
    disputedClaims,
    approvalRate: submitted > 0 ? approved / submitted : null,
    attendanceAverage:
      attendanceCount > 0 ? attendanceSum / attendanceCount : null,
    totalHours,
    scheduleLinkedCount,
    nonDraftCount,
    lastActivityAt,
    recentClaimIds,
  };
}

export function isTutorInactive(
  userActive: boolean,
  lastLoginAt: string | null,
  lastActivityAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!userActive) return true;
  const cutoff = subDays(now, INACTIVE_DAYS).toISOString();
  const loginStale = !lastLoginAt || lastLoginAt < cutoff;
  const activityStale = !lastActivityAt || lastActivityAt < cutoff;
  return loginStale && activityStale;
}

export function groupClaimsByMonth(
  claims: ClaimStatsRow[],
): Map<string, ClaimStatsRow[]> {
  const byMonth = new Map<string, ClaimStatsRow[]>();
  for (const c of claims) {
    const key = c.session_date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(c);
    byMonth.set(key, list);
  }
  return byMonth;
}

import {
  DEFAULT_TUTOR_HOURLY_RATE_CENTS,
  computeAmountCents,
} from "#/lib/money";

export type RateSources = {
  assignmentRateCents?: number | null;
  moduleRateCents?: number | null;
  institutionDefaultRateCents?: number | null;
};

export function resolveTutorHourlyRateCents(sources: RateSources): number {
  if (
    sources.assignmentRateCents != null &&
    sources.assignmentRateCents > 0
  ) {
    return sources.assignmentRateCents;
  }
  if (sources.moduleRateCents != null && sources.moduleRateCents > 0) {
    return sources.moduleRateCents;
  }
  if (
    sources.institutionDefaultRateCents != null &&
    sources.institutionDefaultRateCents > 0
  ) {
    return sources.institutionDefaultRateCents;
  }
  return DEFAULT_TUTOR_HOURLY_RATE_CENTS;
}

export function computeClaimCompensation(
  hours: number,
  sources: RateSources,
): {
  hourlyRateCents: number;
  amountCents: number;
} {
  const hourlyRateCents = resolveTutorHourlyRateCents(sources);
  return {
    hourlyRateCents,
    amountCents: computeAmountCents(hours, hourlyRateCents),
  };
}

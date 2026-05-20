import type { ClaimStatus } from "#/lib/session-claim-display";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";
import { isSessionEnded, type SessionClaimTimingFields } from "#/lib/session-claim-lifecycle";

export type HourBudgetBreakdown = {
  scheduledHours: number;
  requestedHours: number;
  approvedPipelineHours: number;
  completedHours: number;
};

export type TutorModuleHourBudget = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  academicTermId: string;
  academicTermLabel: string;
  allocatedHours: number;
  reservedHours: number;
  workedHours: number;
  availableHours: number;
  utilizationPercent: number;
  breakdown: HourBudgetBreakdown;
};

export type TutorHourBudgetTotals = {
  allocatedHours: number;
  reservedHours: number;
  workedHours: number;
  availableHours: number;
  utilizationPercent: number;
};

export type TutorHourBudgetSummary = {
  totals: TutorHourBudgetTotals;
  byModule: TutorModuleHourBudget[];
};

export type ScheduledSessionBudgetRow = {
  id: string;
  module_id: string;
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  deleted_at: string | null;
};

export type StandaloneClaimBudgetRow = SessionClaimTimingFields & {
  id: string;
  module_id: string;
  tutor_id: string;
  status: ClaimStatus;
  hours: number | string;
  source_scheduled_session_id: string | null;
  deleted_at: string | null;
};

export type AllocationRow = {
  id: string;
  module_id: string;
  academic_term_id: string;
  allocated_hours: number | string;
  module?: { code: string; name: string } | null;
  academic_term?: { label: string } | null;
};

export type AcademicTermRow = {
  id: string;
  institution_id: string;
  label: string;
  start_date: string;
  end_date: string;
};

const RESERVED_CLAIM_STATUSES: ClaimStatus[] = [
  "PENDING_VERIFICATION",
  "DISPUTED",
  "VERIFIED",
  "APPROVED",
];

const WORKED_CLAIM_STATUSES: ClaimStatus[] = ["VERIFIED", "APPROVED"];

export function hoursBetweenTimestamps(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

export function parseClaimHours(hours: number | string): number {
  const raw = typeof hours === "string" ? Number.parseFloat(hours) : hours;
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function isScheduledSessionReserved(status: string): boolean {
  return status === "SCHEDULED" || status === "RESCHEDULED";
}

export function isClaimWorked(
  claim: SessionClaimTimingFields & { status: ClaimStatus },
  now: Date = new Date(),
): boolean {
  return (
    WORKED_CLAIM_STATUSES.includes(claim.status) && isSessionEnded(claim, now)
  );
}

export function classifyStandaloneClaim(
  claim: SessionClaimTimingFields & { status: ClaimStatus },
  now: Date = new Date(),
): "none" | "requested" | "approvedPipeline" | "completed" {
  if (claim.status === "DRAFT" || claim.status === "REJECTED") return "none";
  if (isClaimWorked(claim, now)) return "completed";
  if (claim.status === "PENDING_VERIFICATION" || claim.status === "DISPUTED") {
    return "requested";
  }
  if (RESERVED_CLAIM_STATUSES.includes(claim.status)) return "approvedPipeline";
  return "none";
}

export function resolveTermIdForDate(
  sessionDate: string,
  moduleTermId: string | null,
  terms: AcademicTermRow[],
  institutionId: string,
): string | null {
  if (moduleTermId) return moduleTermId;
  const instTerms = terms.filter((t) => t.institution_id === institutionId);
  const match = instTerms.find(
    (t) => sessionDate >= t.start_date && sessionDate <= t.end_date,
  );
  return match?.id ?? null;
}

type ModuleAccumulator = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  academicTermId: string;
  academicTermLabel: string;
  allocatedHours: number;
  breakdown: HourBudgetBreakdown;
};

function emptyBreakdown(): HourBudgetBreakdown {
  return {
    scheduledHours: 0,
    requestedHours: 0,
    approvedPipelineHours: 0,
    completedHours: 0,
  };
}

function addToBreakdown(
  breakdown: HourBudgetBreakdown,
  key: keyof HourBudgetBreakdown,
  hours: number,
): void {
  breakdown[key] += hours;
}

function reservedFromBreakdown(b: HourBudgetBreakdown): number {
  return b.scheduledHours + b.requestedHours + b.approvedPipelineHours + b.completedHours;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildTutorHourBudget(input: {
  tutorId: string;
  allocations: AllocationRow[];
  scheduledSessions: ScheduledSessionBudgetRow[];
  standaloneClaims: StandaloneClaimBudgetRow[];
  terms: AcademicTermRow[];
  moduleTermByModuleId: Map<string, string | null>;
  moduleInstitutionByModuleId: Map<string, string>;
  now?: Date;
}): TutorHourBudgetSummary {
  const now = input.now ?? new Date();
  const byKey = new Map<string, ModuleAccumulator>();

  const ensureModule = (
    moduleId: string,
    academicTermId: string,
    alloc?: AllocationRow,
  ): ModuleAccumulator => {
    const key = `${moduleId}:${academicTermId}`;
    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        moduleId,
        moduleCode: alloc?.module?.code ?? "",
        moduleName: alloc?.module?.name ?? "",
        academicTermId,
        academicTermLabel: alloc?.academic_term?.label ?? "",
        allocatedHours: alloc
          ? parseClaimHours(alloc.allocated_hours)
          : 0,
        breakdown: emptyBreakdown(),
      };
      byKey.set(key, acc);
    }
    return acc;
  };

  for (const alloc of input.allocations) {
    ensureModule(alloc.module_id, alloc.academic_term_id, alloc);
  }

  const linkedSessionIds = new Set(
    input.standaloneClaims
      .map((c) => c.source_scheduled_session_id)
      .filter((id): id is string => Boolean(id)),
  );

  for (const session of input.scheduledSessions) {
    if (session.tutor_id !== input.tutorId) continue;
    if (session.deleted_at) continue;
    if (!isScheduledSessionReserved(session.status)) continue;

    const sessionDate = session.starts_at.slice(0, 10);
    const institutionId =
      input.moduleInstitutionByModuleId.get(session.module_id) ?? "";
    const termId = resolveTermIdForDate(
      sessionDate,
      input.moduleTermByModuleId.get(session.module_id) ?? null,
      input.terms,
      institutionId,
    );
    if (!termId) continue;

    const hours = hoursBetweenTimestamps(session.starts_at, session.ends_at);
    if (hours <= 0) continue;

    const acc = ensureModule(session.module_id, termId);
    addToBreakdown(acc.breakdown, "scheduledHours", hours);

    const claim = input.standaloneClaims.find(
      (c) => c.source_scheduled_session_id === session.id,
    );
    if (claim && isClaimWorked(claim, now)) {
      addToBreakdown(acc.breakdown, "completedHours", hours);
    }
  }

  for (const claim of input.standaloneClaims) {
    if (claim.tutor_id !== input.tutorId) continue;
    if (claim.deleted_at) continue;
    if (claim.source_scheduled_session_id) continue;

    const institutionId =
      input.moduleInstitutionByModuleId.get(claim.module_id) ?? "";
    const termId = resolveTermIdForDate(
      claim.session_date,
      input.moduleTermByModuleId.get(claim.module_id) ?? null,
      input.terms,
      institutionId,
    );
    if (!termId) continue;

    const bucket = classifyStandaloneClaim(claim, now);
    if (bucket === "none") continue;

    const hours = parseClaimHours(claim.hours);
    if (hours <= 0) continue;

    const acc = ensureModule(claim.module_id, termId);
    if (bucket === "requested") {
      addToBreakdown(acc.breakdown, "requestedHours", hours);
    } else if (bucket === "approvedPipeline") {
      addToBreakdown(acc.breakdown, "approvedPipelineHours", hours);
    } else if (bucket === "completed") {
      addToBreakdown(acc.breakdown, "completedHours", hours);
    }
  }

  const byModule: TutorModuleHourBudget[] = [...byKey.values()]
    .map((acc) => {
      const reservedHours = round1(reservedFromBreakdown(acc.breakdown));
      const workedHours = round1(acc.breakdown.completedHours);
      const allocatedHours = round1(acc.allocatedHours);
      const availableHours = round1(allocatedHours - reservedHours);
      const utilizationPercent =
        allocatedHours > 0
          ? Math.round((workedHours / allocatedHours) * 1000) / 10
          : 0;

      return {
        moduleId: acc.moduleId,
        moduleCode: acc.moduleCode,
        moduleName: acc.moduleName,
        academicTermId: acc.academicTermId,
        academicTermLabel: acc.academicTermLabel,
        allocatedHours,
        reservedHours,
        workedHours,
        availableHours,
        utilizationPercent,
        breakdown: {
          scheduledHours: round1(acc.breakdown.scheduledHours),
          requestedHours: round1(acc.breakdown.requestedHours),
          approvedPipelineHours: round1(acc.breakdown.approvedPipelineHours),
          completedHours: round1(acc.breakdown.completedHours),
        },
      };
    })
    .sort((a, b) =>
      a.moduleCode.localeCompare(b.moduleCode) ||
      a.academicTermLabel.localeCompare(b.academicTermLabel),
    );

  const totals = byModule.reduce<TutorHourBudgetTotals>(
    (t, m) => ({
      allocatedHours: round1(t.allocatedHours + m.allocatedHours),
      reservedHours: round1(t.reservedHours + m.reservedHours),
      workedHours: round1(t.workedHours + m.workedHours),
      availableHours: round1(t.availableHours + m.availableHours),
      utilizationPercent: 0,
    }),
    {
      allocatedHours: 0,
      reservedHours: 0,
      workedHours: 0,
      availableHours: 0,
      utilizationPercent: 0,
    },
  );
  totals.utilizationPercent =
    totals.allocatedHours > 0
      ? Math.round((totals.workedHours / totals.allocatedHours) * 1000) / 10
      : 0;

  return { totals, byModule };
}

/** Sum hours for new occurrences (scheduling guard). */
export function sumOccurrenceHours(
  occurrences: { startsAt: Date; endsAt: Date }[],
): number {
  let total = 0;
  for (const o of occurrences) {
    total += scheduleClaimTimesFromTimestamps(o.startsAt, o.endsAt).hours;
  }
  return round1(total);
}

export function assertReservedCapacity(input: {
  allocatedHours: number | null;
  currentReservedHours: number;
  additionalHours: number;
  moduleCode?: string;
  strict: boolean;
}): void {
  if (input.allocatedHours == null || input.allocatedHours <= 0) {
    if (input.strict) return;
    return;
  }
  const next = round1(input.currentReservedHours + input.additionalHours);
  if (next > input.allocatedHours) {
    const remaining = round1(
      Math.max(0, input.allocatedHours - input.currentReservedHours),
    );
    const mod = input.moduleCode ? ` for ${input.moduleCode}` : "";
    throw new Error(
      `Hour allocation exceeded${mod}: ${next}h would be reserved but only ${input.allocatedHours}h are allocated (${remaining}h remaining).`,
    );
  }
}

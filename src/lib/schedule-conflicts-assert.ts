import { addDays, parseISO, subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectAllSchedulingIssues,
  type ScheduleSessionLike,
  type SchedulingIssue,
  type SchedulingIssueKind,
} from "#/lib/schedule-conflicts";
import { loadTutorBudgetContext } from "#/server-actions/tutor-allocations/load-budget-context";
import { SCHEDULED_SESSION_SELECT } from "#/server-actions/lecturer-schedule/constants";

const BLOCKING_KINDS = new Set<SchedulingIssueKind>([
  "tutor_double_booking",
  "venue_conflict",
  "tutor_overload",
  "allocation_exceeded",
]);

function getMaxTutorHoursPerWeek(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 20;
  const n = (raw as { max_tutor_hours_per_week?: number }).max_tutor_hours_per_week;
  return typeof n === "number" && n > 0 ? n : 20;
}

function mapRowToSession(row: Record<string, unknown>): ScheduleSessionLike {
  const tutor = Array.isArray(row.tutor) ? row.tutor[0] : row.tutor;
  const venue = Array.isArray(row.venue) ? row.venue[0] : row.venue;
  const mod = Array.isArray(row.module) ? row.module[0] : row.module;
  return {
    id: row.id as string,
    tutorId: row.tutor_id as string,
    tutorName: (tutor as { full_name?: string } | null)?.full_name ?? "",
    venueId: (row.venue_id as string | null) ?? null,
    venueName: (venue as { name?: string } | null)?.name ?? null,
    moduleId: row.module_id as string,
    moduleCode: (mod as { code?: string } | null)?.code ?? "",
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    status: row.status as string,
  };
}

function mergeProposedSessions(
  existing: ScheduleSessionLike[],
  proposed: ScheduleSessionLike[],
): ScheduleSessionLike[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const p of proposed) {
    byId.set(p.id, p);
  }
  return [...byId.values()];
}

function issueAffectsProposed(
  issue: SchedulingIssue,
  proposed: ScheduleSessionLike[],
): boolean {
  const proposedIds = new Set(proposed.map((p) => p.id));
  if (issue.sessionIds.some((id) => proposedIds.has(id))) {
    return true;
  }
  if (issue.kind === "allocation_exceeded" && issue.tutorId && issue.moduleId) {
    return proposed.some(
      (p) => p.tutorId === issue.tutorId && p.moduleId === issue.moduleId,
    );
  }
  if (issue.kind === "tutor_overload" && issue.tutorId) {
    return proposed.some((p) => p.tutorId === issue.tutorId);
  }
  return false;
}

type SchedulingContext = {
  sessions: ScheduleSessionLike[];
  assignments: {
    moduleId: string;
    moduleCode: string;
    tutorId: string;
    tutorName: string;
  }[];
  publishedSeries: {
    moduleId: string;
    tutorId: string;
    status: string;
    academicTermId: string | null;
  }[];
  maxTutorHoursPerWeek: number;
  academicTermId: string | null;
  allocationRows: {
    tutorId: string;
    tutorName?: string;
    moduleId: string;
    moduleCode: string;
    allocatedHours: number;
    reservedHours: number;
  }[];
};

async function loadSchedulingContext(
  db: SupabaseClient,
  input: {
    institutionId: string;
    proposed: ScheduleSessionLike[];
    includeMissingCoverage?: boolean;
  },
): Promise<SchedulingContext> {
  const { proposed, institutionId } = input;
  if (!proposed.length) {
    return {
      sessions: [],
      assignments: [],
      publishedSeries: [],
      maxTutorHoursPerWeek: 20,
      academicTermId: null,
      allocationRows: [],
    };
  }

  const { data: institution, error: instErr } = await db
    .from("institutions")
    .select("scheduling_settings")
    .eq("id", institutionId)
    .single();

  if (instErr) throw new Error(instErr.message);
  const maxTutorHoursPerWeek = getMaxTutorHoursPerWeek(institution?.scheduling_settings);

  const moduleIds = [...new Set(proposed.map((p) => p.moduleId))];
  const tutorIds = [...new Set(proposed.map((p) => p.tutorId))];
  const venueIds = [
    ...new Set(proposed.map((p) => p.venueId).filter(Boolean)),
  ] as string[];

  const times = proposed.map((p) => parseISO(p.startsAt));
  const rangeStart = subDays(
    new Date(Math.min(...times.map((t) => t.getTime()))),
    7,
  ).toISOString();
  const rangeEnd = addDays(
    new Date(Math.max(...proposed.map((p) => parseISO(p.endsAt).getTime()))),
    7,
  ).toISOString();

  let sessionQuery = db
    .from("scheduled_sessions")
    .select(SCHEDULED_SESSION_SELECT)
    .in("module_id", moduleIds)
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd)
    .is("deleted_at", null);

  if (tutorIds.length === 1 && !venueIds.length) {
    sessionQuery = sessionQuery.eq("tutor_id", tutorIds[0]!);
  } else if (venueIds.length && tutorIds.length) {
    sessionQuery = sessionQuery.or(
      `tutor_id.in.(${tutorIds.join(",")}),venue_id.in.(${venueIds.join(",")})`,
    );
  } else if (tutorIds.length) {
    sessionQuery = sessionQuery.in("tutor_id", tutorIds);
  }

  const { data: rows, error: sessErr } = await sessionQuery;
  if (sessErr) throw new Error(sessErr.message);

  const existing = (rows ?? []).map((r) =>
    mapRowToSession(r as Record<string, unknown>),
  );
  const sessions = mergeProposedSessions(existing, proposed);

  const { data: terms } = await db
    .from("academic_terms")
    .select("id, is_current")
    .eq("institution_id", institutionId)
    .order("start_date", { ascending: false });

  const currentTerm =
    (terms ?? []).find((t) => t.is_current) ?? terms?.[0] ?? null;
  const academicTermId = (currentTerm?.id as string | undefined) ?? null;

  const { data: assignRows, error: assignErr } = await db
    .from("tutor_assignments")
    .select(
      `
      module_id,
      tutor_id,
      module:modules ( code ),
      tutor:users!tutor_assignments_tutor_id_fkey ( full_name )
    `,
    )
    .in("module_id", moduleIds)
    .eq("is_active", true);

  if (assignErr) throw new Error(assignErr.message);

  const assignments = (assignRows ?? []).map((row) => {
    const r = row as unknown as {
      module_id: string;
      tutor_id: string;
      module: { code: string } | null;
      tutor: { full_name: string } | null;
    };
    return {
      moduleId: r.module_id,
      moduleCode: r.module?.code ?? "",
      tutorId: r.tutor_id,
      tutorName: r.tutor?.full_name ?? "Tutor",
    };
  });

  let seriesQuery = db
    .from("schedule_series")
    .select("module_id, tutor_id, status, academic_term_id")
    .in("module_id", moduleIds);

  if (academicTermId) {
    seriesQuery = seriesQuery.or(
      `academic_term_id.eq.${academicTermId},academic_term_id.is.null`,
    );
  }

  const { data: seriesRows, error: seriesErr } = await seriesQuery;
  if (seriesErr) throw new Error(seriesErr.message);

  const publishedSeries = (seriesRows ?? []).map((s) => ({
    moduleId: s.module_id as string,
    tutorId: s.tutor_id as string,
    status: s.status as string,
    academicTermId: (s.academic_term_id as string | null) ?? null,
  }));

  const { data: allocationTutors, error: allocTutorErr } = await db
    .from("tutor_hour_allocations")
    .select("tutor_id")
    .eq("institution_id", institutionId);

  if (allocTutorErr) throw new Error(allocTutorErr.message);

  const allocTutorIdSet = new Set(
    (allocationTutors ?? []).map((r) => r.tutor_id as string),
  );
  for (const t of tutorIds) {
    allocTutorIdSet.add(t);
  }

  const allocationRows: SchedulingContext["allocationRows"] = [];

  for (const tutorId of allocTutorIdSet) {
    const { summary } = await loadTutorBudgetContext(db, tutorId, institutionId);
    const { data: tutorUser } = await db
      .from("users")
      .select("full_name")
      .eq("id", tutorId)
      .maybeSingle();

    for (const m of summary.byModule) {
      if (m.allocatedHours <= 0) continue;
      if (!moduleIds.includes(m.moduleId)) continue;
      allocationRows.push({
        tutorId,
        tutorName: (tutorUser?.full_name as string) ?? undefined,
        moduleId: m.moduleId,
        moduleCode: m.moduleCode,
        allocatedHours: m.allocatedHours,
        reservedHours: m.reservedHours,
      });
    }
  }

  return {
    sessions,
    assignments,
    publishedSeries,
    maxTutorHoursPerWeek,
    academicTermId,
    allocationRows,
  };
}

/** Hard-block mutations when proposed sessions introduce scheduling conflicts. */
export async function assertNoSchedulingConflicts(
  db: SupabaseClient,
  input: {
    institutionId: string;
    proposedSessions: ScheduleSessionLike[];
    includeMissingCoverage?: boolean;
  },
): Promise<void> {
  const proposed = input.proposedSessions.filter((s) =>
    ["SCHEDULED", "RESCHEDULED"].includes(s.status),
  );
  if (!proposed.length) return;

  const ctx = await loadSchedulingContext(db, {
    institutionId: input.institutionId,
    proposed,
    includeMissingCoverage: input.includeMissingCoverage,
  });

  const issues = detectAllSchedulingIssues({
    sessions: ctx.sessions,
    assignments: ctx.assignments,
    publishedSeries: ctx.publishedSeries,
    maxHoursPerWeek: ctx.maxTutorHoursPerWeek,
    academicTermId: ctx.academicTermId,
    allocationRows: ctx.allocationRows,
  });

  const blocking = issues.filter(
    (i) =>
      BLOCKING_KINDS.has(i.kind) &&
      issueAffectsProposed(i, proposed) &&
      (input.includeMissingCoverage || i.kind !== "missing_schedule"),
  );

  if (blocking.length > 0) {
    throw new Error(blocking[0]!.message);
  }
}

/** Resolve institution id for a module. */
export async function getModuleInstitutionId(
  db: SupabaseClient,
  moduleId: string,
): Promise<string> {
  const { data, error } = await db
    .from("modules")
    .select("institution_id")
    .eq("id", moduleId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const institutionId = data?.institution_id as string | undefined;
  if (!institutionId) {
    throw new Error("Module institution could not be determined.");
  }
  return institutionId;
}

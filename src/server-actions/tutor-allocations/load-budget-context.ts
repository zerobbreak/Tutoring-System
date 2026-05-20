import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTutorHourBudget,
  type AcademicTermRow,
  type AllocationRow,
  type ScheduledSessionBudgetRow,
  type StandaloneClaimBudgetRow,
  type TutorHourBudgetSummary,
} from "#/lib/tutor-hour-budget";

type Db = SupabaseClient;

export async function loadTutorBudgetContext(
  db: Db,
  tutorId: string,
  institutionId: string,
): Promise<{
  summary: TutorHourBudgetSummary;
  allocationByModuleTerm: Map<string, number>;
}> {
  const { data: allocations, error: allocErr } = await db
    .from("tutor_hour_allocations")
    .select(
      "id, module_id, academic_term_id, allocated_hours, module:modules ( code, name ), academic_term:academic_terms ( label )",
    )
    .eq("tutor_id", tutorId)
    .eq("institution_id", institutionId);

  if (allocErr) throw new Error(allocErr.message);

  const { data: modules, error: modErr } = await db
    .from("modules")
    .select("id, institution_id, academic_term_id")
    .eq("institution_id", institutionId);

  if (modErr) throw new Error(modErr.message);

  const moduleIds = (modules ?? []).map((m) => m.id as string);
  const moduleTermByModuleId = new Map<string, string | null>();
  const moduleInstitutionByModuleId = new Map<string, string>();
  for (const m of modules ?? []) {
    moduleTermByModuleId.set(
      m.id as string,
      (m.academic_term_id as string | null) ?? null,
    );
    moduleInstitutionByModuleId.set(
      m.id as string,
      m.institution_id as string,
    );
  }

  const { data: terms, error: termErr } = await db
    .from("academic_terms")
    .select("id, institution_id, label, start_date, end_date")
    .eq("institution_id", institutionId);

  if (termErr) throw new Error(termErr.message);

  let scheduledSessions: ScheduledSessionBudgetRow[] = [];
  if (moduleIds.length) {
    const { data: sessions, error: sessErr } = await db
      .from("scheduled_sessions")
      .select("id, module_id, tutor_id, starts_at, ends_at, status, deleted_at")
      .eq("tutor_id", tutorId)
      .in("module_id", moduleIds)
      .is("deleted_at", null);

    if (sessErr) throw new Error(sessErr.message);
    scheduledSessions = (sessions ?? []) as ScheduledSessionBudgetRow[];
  }

  const { data: claims, error: claimErr } = await db
    .from("session_claims")
    .select(
      "id, module_id, tutor_id, status, hours, source_scheduled_session_id, deleted_at, session_date, start_time, end_time",
    )
    .eq("tutor_id", tutorId)
    .is("deleted_at", null);

  if (claimErr) throw new Error(claimErr.message);

  const allocationRows = (allocations ?? []).map((row) => {
    const mod = row.module as { code: string; name: string } | { code: string; name: string }[] | null;
    const term = row.academic_term as { label: string } | { label: string }[] | null;
    return {
      ...row,
      module: Array.isArray(mod) ? (mod[0] ?? null) : mod,
      academic_term: Array.isArray(term) ? (term[0] ?? null) : term,
    } as AllocationRow;
  });

  const summary = buildTutorHourBudget({
    tutorId,
    allocations: allocationRows,
    scheduledSessions,
    standaloneClaims: (claims ?? []) as StandaloneClaimBudgetRow[],
    terms: (terms ?? []) as AcademicTermRow[],
    moduleTermByModuleId,
    moduleInstitutionByModuleId,
  });

  const allocationByModuleTerm = new Map<string, number>();
  for (const a of allocationRows) {
    allocationByModuleTerm.set(
      `${a.module_id}:${a.academic_term_id}`,
      typeof a.allocated_hours === "string"
        ? Number.parseFloat(a.allocated_hours)
        : a.allocated_hours,
    );
  }

  return { summary, allocationByModuleTerm };
}

export async function getAllocationForModuleTerm(
  db: Db,
  tutorId: string,
  moduleId: string,
  academicTermId: string,
): Promise<number | null> {
  const { data, error } = await db
    .from("tutor_hour_allocations")
    .select("allocated_hours")
    .eq("tutor_id", tutorId)
    .eq("module_id", moduleId)
    .eq("academic_term_id", academicTermId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const raw = data.allocated_hours as number | string;
  const n = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  return Number.isFinite(n) ? n : null;
}

export async function resolveAcademicTermIdForModule(
  db: Db,
  moduleId: string,
  sessionDate: string,
): Promise<string | null> {
  const { data: mod, error: modErr } = await db
    .from("modules")
    .select("academic_term_id, institution_id")
    .eq("id", moduleId)
    .maybeSingle();

  if (modErr) throw new Error(modErr.message);
  if (!mod) return null;
  if (mod.academic_term_id) return mod.academic_term_id as string;

  const { data: term, error: termErr } = await db
    .from("academic_terms")
    .select("id")
    .eq("institution_id", mod.institution_id as string)
    .lte("start_date", sessionDate)
    .gte("end_date", sessionDate)
    .limit(1)
    .maybeSingle();

  if (termErr) throw new Error(termErr.message);
  return (term?.id as string) ?? null;
}

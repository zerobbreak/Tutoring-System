import { format, subDays } from "date-fns";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  CANCELLED_SESSION_SELECT,
} from "#/server-actions/lecturer-sessions/constants";
import type { CancelledScheduleRowDTO } from "./types";

type Supabase = ReturnType<typeof createSupabaseServerClient>;

export type SessionListFilters = {
  lookbackDays: number;
  moduleId?: string | null;
  tutorId?: string | null;
  lecturerId?: string | null;
};

export function lookbackFromDate(lookbackDays: number): string {
  return format(subDays(new Date(), lookbackDays), "yyyy-MM-dd");
}

export async function resolveInstitutionModuleIds(
  supabase: Supabase,
  institutionId: string,
  filters: Pick<SessionListFilters, "moduleId" | "tutorId" | "lecturerId">,
): Promise<string[]> {
  let query = supabase
    .from("modules")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("is_active", true);

  if (filters.moduleId) {
    query = query.eq("id", filters.moduleId);
  }
  if (filters.lecturerId) {
    query = query.eq("lecturer_id", filters.lecturerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let moduleIds = (data ?? []).map((m) => m.id as string);

  if (filters.tutorId) {
    if (!moduleIds.length) return [];
    const { data: assignments, error: assignErr } = await supabase
      .from("tutor_assignments")
      .select("module_id")
      .eq("tutor_id", filters.tutorId)
      .eq("is_active", true)
      .in("module_id", moduleIds);

    if (assignErr) throw new Error(assignErr.message);
    const assigned = new Set((assignments ?? []).map((a) => a.module_id as string));
    moduleIds = moduleIds.filter((id) => assigned.has(id));
  }

  return moduleIds;
}

export async function assertModuleInInstitution(
  supabase: Supabase,
  moduleId: string,
  institutionId: string,
): Promise<void> {
  const { data: mod, error } = await supabase
    .from("modules")
    .select("id")
    .eq("id", moduleId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!mod) throw new Error("Module not found or access denied.");
}

export async function loadCancelledSchedule(
  supabase: Supabase,
  moduleIds: string[],
): Promise<CancelledScheduleRowDTO[]> {
  if (!moduleIds.length) return [];

  const { data: cancelledRows, error: cancelErr } = await supabase
    .from("scheduled_sessions")
    .select(CANCELLED_SESSION_SELECT)
    .in("module_id", moduleIds)
    .eq("status", "CANCELLED")
    .order("starts_at", { ascending: false });

  if (cancelErr) throw new Error(cancelErr.message);

  const scheduledIds = (cancelledRows ?? []).map((r) => r.id as string);
  const claimByScheduled = new Map<string, string>();

  if (scheduledIds.length) {
    const { data: linkedClaims } = await supabase
      .from("session_claims")
      .select("id, source_scheduled_session_id")
      .in("source_scheduled_session_id", scheduledIds);

    for (const c of linkedClaims ?? []) {
      if (c.source_scheduled_session_id) {
        claimByScheduled.set(
          c.source_scheduled_session_id as string,
          c.id as string,
        );
      }
    }
  }

  return (cancelledRows ?? []).map((row) => {
    const mod = Array.isArray(row.module) ? row.module[0] : row.module;
    const tutor = Array.isArray(row.tutor) ? row.tutor[0] : row.tutor;
    const series = Array.isArray(row.series) ? row.series[0] : row.series;
    const id = row.id as string;
    return {
      id,
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
      venue_text: row.venue_text as string | null,
      title: (series as { title?: string } | null)?.title ?? "Session",
      module_code: (mod as { code?: string })?.code ?? "",
      module_name: (mod as { name?: string })?.name ?? "",
      tutor_name: (tutor as { full_name?: string })?.full_name ?? "",
      linked_claim_id: claimByScheduled.get(id) ?? null,
    };
  });
}

import type { createSupabaseServerClient } from "#/lib/supabase-server";
import type { AdminScheduleCalendarScope } from "./types";

type Supabase = ReturnType<typeof createSupabaseServerClient>;

export type SchedulingSettings = {
  max_tutor_hours_per_week?: number;
};

export function parseSchedulingSettings(raw: unknown): SchedulingSettings {
  if (!raw || typeof raw !== "object") return {};
  return raw as SchedulingSettings;
}

export function getMaxTutorHoursPerWeek(settings: SchedulingSettings): number {
  const n = settings.max_tutor_hours_per_week;
  return typeof n === "number" && n > 0 ? n : 20;
}

export async function resolveModuleIdsForScope(
  supabase: Supabase,
  institutionId: string,
  scope: AdminScheduleCalendarScope,
  scopeEntityId: string | null,
): Promise<string[]> {
  let query = supabase
    .from("modules")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("is_active", true);

  if (scope === "module" && scopeEntityId) {
    query = query.eq("id", scopeEntityId);
  } else if (scope === "lecturer" && scopeEntityId) {
    query = query.eq("lecturer_id", scopeEntityId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let moduleIds = (data ?? []).map((m) => m.id as string);

  if (scope === "tutor" && scopeEntityId) {
    if (!moduleIds.length) return [];
    const { data: assignments, error: assignErr } = await supabase
      .from("tutor_assignments")
      .select("module_id")
      .eq("tutor_id", scopeEntityId)
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
): Promise<{ institutionId: string }> {
  const { data: mod, error } = await supabase
    .from("modules")
    .select("id, institution_id")
    .eq("id", moduleId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!mod) throw new Error("Module not found or access denied.");
  return { institutionId: mod.institution_id as string };
}

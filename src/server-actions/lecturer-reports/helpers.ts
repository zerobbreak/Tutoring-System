import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireLecturerId } from "#/lib/lecturer-server";
import type { LecturerModuleRow } from "./types";

export async function loadLecturerContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const lecturerId = await requireLecturerId(supabase);

  const { data: modules, error } = await supabase
    .from("modules")
    .select("id, code, name")
    .eq("lecturer_id", lecturerId)
    .order("code", { ascending: true });

  if (error) throw new Error(error.message);

  const moduleRows = (modules ?? []).map((m) => ({
    id: m.id as string,
    code: m.code as string,
    name: m.name as string,
  }));

  return { lecturerId, modules: moduleRows };
}

export function resolveModuleIds(
  modules: LecturerModuleRow[],
  moduleId?: string,
): string[] {
  if (!modules.length) return [];
  if (moduleId) {
    const found = modules.some((m) => m.id === moduleId);
    if (!found) throw new Error("Module not found.");
    return [moduleId];
  }
  return modules.map((m) => m.id);
}

export function pct(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${Math.round(n * 100)}%`;
}

export function parseHours(raw: number | string): number {
  const hours = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
  return Number.isFinite(hours) ? hours : 0;
}

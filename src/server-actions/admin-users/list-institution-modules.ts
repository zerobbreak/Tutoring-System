import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { InstitutionModuleOptionDTO } from "./types";

export const listInstitutionModulesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ modules: InstitutionModuleOptionDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data, error } = await supabase
      .from("modules")
      .select("id, code, name, lecturer_id")
      .eq("institution_id", institutionId)
      .order("code", { ascending: true });

    if (error) throw new Error(error.message);

    const lecturerIds = [
      ...new Set((data ?? []).map((m) => m.lecturer_id as string)),
    ];
    const nameById = new Map<string, string>();
    if (lecturerIds.length) {
      const { data: lecturers } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", lecturerIds);
      for (const l of lecturers ?? []) {
        nameById.set(l.id as string, l.full_name as string);
      }
    }

    const modules: InstitutionModuleOptionDTO[] = (data ?? []).map((row) => ({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      lecturer_id: row.lecturer_id as string,
      lecturer_name: nameById.get(row.lecturer_id as string) ?? null,
    }));

    return { modules };
  },
);

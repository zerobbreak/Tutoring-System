import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { TutorHourAllocationDTO } from "./list-tutor-allocations";

const schema = z.object({ tutorId: z.string().uuid() });

export const adminListTutorAllocationsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<TutorHourAllocationDTO[]> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: rows, error } = await supabase
      .from("tutor_hour_allocations")
      .select(
        "id, module_id, academic_term_id, allocated_hours, module:modules ( code, name ), academic_term:academic_terms ( label )",
      )
      .eq("tutor_id", data.tutorId)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => {
      const mod = row.module as { code: string; name: string } | { code: string; name: string }[] | null;
      const term = row.academic_term as { label: string } | { label: string }[] | null;
      const m = Array.isArray(mod) ? mod[0] : mod;
      const t = Array.isArray(term) ? term[0] : term;
      const raw = row.allocated_hours as number | string;
      const allocatedHours = typeof raw === "string" ? Number.parseFloat(raw) : raw;

      return {
        id: row.id as string,
        moduleId: row.module_id as string,
        moduleCode: m?.code ?? "",
        moduleName: m?.name ?? "",
        academicTermId: row.academic_term_id as string,
        academicTermLabel: t?.label ?? "",
        allocatedHours: Number.isFinite(allocatedHours) ? allocatedHours : 0,
      };
    });
  });

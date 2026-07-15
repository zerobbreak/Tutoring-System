import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const schema = z.object({
  tutorId: z.string().uuid(),
  moduleId: z.string().uuid(),
  academicTermId: z.string().uuid(),
  allocatedHours: z.number().positive().max(9999),
});

export const adminUpsertTutorHourAllocationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("id, institution_id")
      .eq("id", data.moduleId)
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (modErr) throw new Error(modErr.message);
    if (!mod) throw new Error("Module not found or access denied.");

    const { data: existing, error: selErr } = await supabase
      .from("tutor_hour_allocations")
      .select("id")
      .eq("tutor_id", data.tutorId)
      .eq("module_id", data.moduleId)
      .eq("academic_term_id", data.academicTermId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("tutor_hour_allocations")
        .update({
          allocated_hours: data.allocatedHours,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updErr) throw new Error(updErr.message);
      return { id: existing.id as string };
    }

    const { data: inserted, error: insErr } = await supabase
      .from("tutor_hour_allocations")
      .insert({
        institution_id: institutionId,
        tutor_id: data.tutorId,
        module_id: data.moduleId,
        academic_term_id: data.academicTermId,
        allocated_hours: data.allocatedHours,
        created_by: userId,
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { id: inserted.id as string };
  });

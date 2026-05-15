import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const assignSchema = z.object({
  moduleId: z.string().uuid(),
  tutorId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const assignTutorToModuleFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => assignSchema.parse(input))
  .handler(async ({ data }): Promise<{ assignmentId: string }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("id")
      .eq("id", data.moduleId)
      .eq("lecturer_id", lecturerId)
      .maybeSingle();

    if (modErr) throw new Error(modErr.message);
    if (!mod) throw new Error("Module not found or access denied.");

    const { data: existing } = await supabase
      .from("tutor_assignments")
      .select("id")
      .eq("module_id", data.moduleId)
      .eq("tutor_id", data.tutorId)
      .eq("is_active", true)
      .maybeSingle();

    if (existing?.id) return { assignmentId: existing.id as string };

    const { data: inserted, error: insErr } = await supabase
      .from("tutor_assignments")
      .insert({
        module_id: data.moduleId,
        tutor_id: data.tutorId,
        start_date: data.startDate,
        end_date: data.endDate ?? null,
        is_active: true,
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { assignmentId: inserted.id as string };
  });

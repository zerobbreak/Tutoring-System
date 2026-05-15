import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const removeSchema = z.object({
  moduleId: z.string().uuid(),
  tutorId: z.string().uuid(),
});

export const removeTutorFromModuleFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => removeSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
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

    const today = format(new Date(), "yyyy-MM-dd");

    const { error: updErr } = await supabase
      .from("tutor_assignments")
      .update({ is_active: false, end_date: today })
      .eq("module_id", data.moduleId)
      .eq("tutor_id", data.tutorId)
      .eq("is_active", true);

    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

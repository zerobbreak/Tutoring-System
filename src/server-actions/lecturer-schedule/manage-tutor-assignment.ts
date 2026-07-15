import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireLecturerInstitutionId } from "#/server-actions/lecturer-tutors/require-lecturer-institution";

const assignSchema = z.object({
  moduleId: z.string().uuid(),
  tutorId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const assignTutorToModuleFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => assignSchema.parse(input))
  .handler(async ({ data }): Promise<{ assignmentId: string }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const institutionId = await requireLecturerInstitutionId(
      supabase,
      lecturerId,
    );

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

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const { data: tutorRow, error: tutorErr } = await db
      .from("users")
      .select("id, role, institution_id")
      .eq("id", data.tutorId)
      .maybeSingle();

    if (tutorErr) throw new Error(tutorErr.message);
    if (!tutorRow || tutorRow.role !== "TUTOR") {
      throw new Error("Tutor not found.");
    }
    if (tutorRow.institution_id && tutorRow.institution_id !== institutionId) {
      throw new Error("This tutor belongs to a different institution.");
    }

    if (!tutorRow.institution_id && admin) {
      const { error: linkErr } = await admin
        .from("users")
        .update({ institution_id: institutionId })
        .eq("id", data.tutorId);
      if (linkErr) throw new Error(linkErr.message);
    }

    const { data: inserted, error: insErr } = await db
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

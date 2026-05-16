import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertModuleInInstitution } from "./helpers";
import { createSeriesSchema } from "./schemas";

export const adminCreateScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSeriesSchema.parse(input))
  .handler(async ({ data }): Promise<{ seriesId: string }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    await assertModuleInInstitution(supabase, data.moduleId, institutionId);

    const { data: assignment, error: assignErr } = await supabase
      .from("tutor_assignments")
      .select("id")
      .eq("module_id", data.moduleId)
      .eq("tutor_id", data.tutorId)
      .eq("is_active", true)
      .maybeSingle();

    if (assignErr) throw new Error(assignErr.message);
    if (!assignment) {
      throw new Error(
        "Assign this tutor to the module before creating a schedule series.",
      );
    }

    const academicTermId = data.academicTermId ?? null;

    const { data: inserted, error: insErr } = await supabase
      .from("schedule_series")
      .insert({
        module_id: data.moduleId,
        institution_id: institutionId,
        academic_term_id: academicTermId,
        created_by: userId,
        title: data.title.trim(),
        session_kind: data.sessionKind?.trim() || "tutorial",
        tutor_id: data.tutorId,
        venue_id: data.venueId ?? null,
        venue_text: data.venueText?.trim() || null,
        timezone: data.timezone ?? "Africa/Johannesburg",
        dtstart: data.dtstart,
        duration_minutes: data.durationMinutes,
        recurrence_json: data.recurrence,
        status: "DRAFT",
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { seriesId: inserted.id as string };
  });

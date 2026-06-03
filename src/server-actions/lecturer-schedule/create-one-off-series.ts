import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { publishScheduleSeriesCore } from "#/lib/schedule-claims";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const oneOffSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(255),
  tutorId: z.string().uuid(),
  dtstart: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(24 * 60),
  venueId: z.string().uuid().nullable().optional(),
  venueText: z.string().max(255).nullable().optional(),
  sessionKind: z.string().max(50).optional(),
});

export const createOneOffScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => oneOffSchema.parse(input))
  .handler(async ({ data }): Promise<{ seriesId: string; sessionCount: number }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const start = new Date(data.dtstart);
    const sessionDate = format(start, "yyyy-MM-dd");

    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("id, institution_id, academic_term_id")
      .eq("id", data.moduleId)
      .eq("lecturer_id", lecturerId)
      .maybeSingle();

    if (modErr) throw new Error(modErr.message);
    if (!mod) throw new Error("Module not found or access denied.");

    const { data: assignment, error: assignErr } = await supabase
      .from("tutor_assignments")
      .select("id")
      .eq("module_id", data.moduleId)
      .eq("tutor_id", data.tutorId)
      .eq("is_active", true)
      .maybeSingle();

    if (assignErr) throw new Error(assignErr.message);
    if (!assignment) {
      throw new Error("Assign this tutor to the module before scheduling a session.");
    }

    const { data: inserted, error: insErr } = await supabase
      .from("schedule_series")
      .insert({
        module_id: data.moduleId,
        institution_id: mod.institution_id as string,
        academic_term_id: (mod.academic_term_id as string | null) ?? null,
        created_by: lecturerId,
        title: data.title.trim(),
        session_kind: data.sessionKind?.trim() || "one_off",
        tutor_id: data.tutorId,
        venue_id: data.venueId ?? null,
        venue_text: data.venueText?.trim() || null,
        timezone: "Africa/Johannesburg",
        dtstart: data.dtstart,
        duration_minutes: data.durationMinutes,
        recurrence_json: {
          frequency: "explicit_dates",
          dates: [sessionDate],
        },
        status: "DRAFT",
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    const seriesId = inserted.id as string;

    const { sessionCount } = await publishScheduleSeriesCore(supabase, {
      seriesId,
      materializeMode: "first_publish",
      actorId: lecturerId,
    });

    return { seriesId, sessionCount };
  });

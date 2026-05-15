import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const recurrenceSchema = z.object({
  frequency: z.literal("weekly"),
  byWeekday: z.array(z.number().int().min(0).max(6)).min(1),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

const createSeriesSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(255),
  sessionKind: z.string().max(50).optional(),
  tutorId: z.string().uuid(),
  venueId: z.string().uuid().nullable().optional(),
  venueText: z.string().max(255).nullable().optional(),
  timezone: z.string().max(64).optional(),
  dtstart: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(24 * 60),
  recurrence: recurrenceSchema,
});

export const createScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSeriesSchema.parse(input))
  .handler(async ({ data }): Promise<{ seriesId: string }> => {
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

    const { data: inserted, error: insErr } = await supabase
      .from("schedule_series")
      .insert({
        module_id: data.moduleId,
        created_by: lecturerId,
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

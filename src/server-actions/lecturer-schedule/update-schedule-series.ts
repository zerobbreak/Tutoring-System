import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { recurrenceSchema } from "#/lib/schedule-recurrence-schema";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const updateSeriesSchema = z.object({
  seriesId: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  sessionKind: z.string().max(50).optional(),
  tutorId: z.string().uuid().optional(),
  venueId: z.string().uuid().nullable().optional(),
  venueText: z.string().max(255).nullable().optional(),
  dtstart: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(24 * 60).optional(),
  recurrence: recurrenceSchema.optional(),
});

export const updateScheduleSeriesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateSeriesSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const { data: series, error: fetchErr } = await supabase
      .from("schedule_series")
      .select("id, status, module_id")
      .eq("id", data.seriesId)
      .single();

    if (fetchErr) throw new Error(fetchErr.message);
    if (series.status !== "DRAFT") {
      throw new Error("Only draft series can be edited. Archive and create a new series to change published schedules.");
    }

    if (data.tutorId) {
      const { data: assignment, error: assignErr } = await supabase
        .from("tutor_assignments")
        .select("id")
        .eq("module_id", series.module_id as string)
        .eq("tutor_id", data.tutorId)
        .eq("is_active", true)
        .maybeSingle();

      if (assignErr) throw new Error(assignErr.message);
      if (!assignment) {
        throw new Error("Assign this tutor to the module before updating the series.");
      }
    }

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.sessionKind !== undefined) patch.session_kind = data.sessionKind.trim();
    if (data.tutorId !== undefined) patch.tutor_id = data.tutorId;
    if (data.venueId !== undefined) patch.venue_id = data.venueId;
    if (data.venueText !== undefined) patch.venue_text = data.venueText?.trim() || null;
    if (data.dtstart !== undefined) patch.dtstart = data.dtstart;
    if (data.durationMinutes !== undefined) patch.duration_minutes = data.durationMinutes;
    if (data.recurrence !== undefined) patch.recurrence_json = data.recurrence;

    const { error: updErr } = await supabase
      .from("schedule_series")
      .update(patch)
      .eq("id", data.seriesId);

    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

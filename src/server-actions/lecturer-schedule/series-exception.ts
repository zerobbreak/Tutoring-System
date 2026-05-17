import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";

const exceptionSchema = z.object({
  seriesId: z.string().uuid(),
  occurrenceStartsAt: z.string().datetime(),
  action: z.enum(["CANCEL", "OVERRIDE"]),
  overrideStartsAt: z.string().datetime().optional(),
  overrideEndsAt: z.string().datetime().optional(),
  overrideVenueId: z.string().uuid().nullable().optional(),
  overrideVenueText: z.string().max(255).nullable().optional(),
  overrideTutorId: z.string().uuid().optional(),
});

export const createSeriesExceptionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => exceptionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const { data: series, error: seriesErr } = await supabase
      .from("schedule_series")
      .select("id, status")
      .eq("id", data.seriesId)
      .single();

    if (seriesErr) throw new Error(seriesErr.message);
    if (series.status !== "PUBLISHED") {
      throw new Error("Exceptions apply only to published series.");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error: exErr } = await supabase.from("schedule_series_exceptions").upsert(
      {
        series_id: data.seriesId,
        occurrence_starts_at: data.occurrenceStartsAt,
        action: data.action,
        override_starts_at: data.overrideStartsAt ?? null,
        override_ends_at: data.overrideEndsAt ?? null,
        override_venue_id: data.overrideVenueId ?? null,
        override_venue_text: data.overrideVenueText?.trim() || null,
        override_tutor_id: data.overrideTutorId ?? null,
        created_by: user.id,
      },
      { onConflict: "series_id,occurrence_starts_at" },
    );

    if (exErr) throw new Error(exErr.message);

    const { data: session, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select("id, tutor_id, module_id")
      .eq("series_id", data.seriesId)
      .eq("starts_at", data.occurrenceStartsAt)
      .maybeSingle();

    if (sessErr) throw new Error(sessErr.message);
    if (!session) return { ok: true };

    if (data.action === "CANCEL") {
      const now = new Date().toISOString();
      await supabase
        .from("scheduled_sessions")
        .update({
          status: "CANCELLED",
          cancelled_at: now,
          cancelled_by: user.id,
          cancellation_reason: "Cancelled via series exception",
        })
        .eq("id", session.id);
      return { ok: true };
    }

    if (data.overrideStartsAt && data.overrideEndsAt) {
      const startsAt = new Date(data.overrideStartsAt);
      const endsAt = new Date(data.overrideEndsAt);

      await supabase
        .from("scheduled_sessions")
        .update({
          starts_at: data.overrideStartsAt,
          ends_at: data.overrideEndsAt,
          status: "RESCHEDULED",
          venue_id: data.overrideVenueId ?? undefined,
          venue_text: data.overrideVenueText ?? undefined,
          tutor_id: data.overrideTutorId ?? undefined,
        })
        .eq("id", session.id);

      const times = scheduleClaimTimesFromTimestamps(startsAt, endsAt);
      const venue = data.overrideVenueText?.trim() || null;

      await supabase
        .from("session_claims")
        .update({
          session_date: times.session_date,
          start_time: times.start_time,
          end_time: times.end_time,
          hours: times.hours,
          venue,
          tutor_id: data.overrideTutorId ?? session.tutor_id,
        })
        .eq("source_scheduled_session_id", session.id)
        .eq("status", "DRAFT");
    }

    return { ok: true };
  });

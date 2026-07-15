import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import {
  assertNoSchedulingConflicts,
  getModuleInstitutionId,
} from "#/lib/schedule-conflicts-assert";
import type { ScheduleSessionLike } from "#/lib/schedule-conflicts";
import {
  loadScheduledSessionSnapshot,
  syncScheduledSessionAfterUpdate,
} from "#/lib/schedule-sync";
import { createSupabaseServerClient } from "#/lib/supabase-server";

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
  .validator((input: unknown) => exceptionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: series, error: seriesErr } = await supabase
      .from("schedule_series")
      .select("id, status")
      .eq("id", data.seriesId)
      .single();

    if (seriesErr) throw new Error(seriesErr.message);
    if (series.status !== "PUBLISHED") {
      throw new Error("Exceptions apply only to published series.");
    }

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
        created_by: lecturerId,
      },
      { onConflict: "series_id,occurrence_starts_at" },
    );

    if (exErr) throw new Error(exErr.message);

    const { data: session, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("series_id", data.seriesId)
      .eq("starts_at", data.occurrenceStartsAt)
      .is("deleted_at", null)
      .maybeSingle();

    if (sessErr) throw new Error(sessErr.message);
    if (!session?.id) return { ok: true };

    const sessionId = session.id as string;
    const before = await loadScheduledSessionSnapshot(supabase, sessionId);
    if (!before) return { ok: true };

    if (data.action === "CANCEL") {
      const now = new Date().toISOString();
      const { error: cancelErr } = await supabase
        .from("scheduled_sessions")
        .update({
          status: "CANCELLED",
          cancelled_at: now,
          cancelled_by: lecturerId,
          cancellation_reason: "Cancelled via series exception",
        })
        .eq("id", sessionId);

      if (cancelErr) throw new Error(cancelErr.message);
    } else if (data.overrideStartsAt && data.overrideEndsAt) {
      const institutionId = await getModuleInstitutionId(supabase, before.moduleId);
      const proposed: ScheduleSessionLike = {
        id: sessionId,
        tutorId: data.overrideTutorId ?? before.tutorId,
        moduleId: before.moduleId,
        moduleCode: before.moduleCode,
        venueId: data.overrideVenueId ?? before.venueId,
        startsAt: data.overrideStartsAt,
        endsAt: data.overrideEndsAt,
        status: "RESCHEDULED",
      };
      await assertNoSchedulingConflicts(supabase, {
        institutionId,
        proposedSessions: [proposed],
      });

      const patch: Record<string, unknown> = {
        starts_at: data.overrideStartsAt,
        ends_at: data.overrideEndsAt,
        status: "RESCHEDULED",
      };
      if (data.overrideVenueId !== undefined) {
        patch.venue_id = data.overrideVenueId;
      }
      if (data.overrideVenueText !== undefined) {
        patch.venue_text = data.overrideVenueText?.trim() || null;
      }
      if (data.overrideTutorId) {
        patch.tutor_id = data.overrideTutorId;
      }

      const { error: upErr } = await supabase
        .from("scheduled_sessions")
        .update(patch)
        .eq("id", sessionId);

      if (upErr) throw new Error(upErr.message);
    }

    await syncScheduledSessionAfterUpdate(supabase, {
      scheduledSessionId: sessionId,
      actorId: lecturerId,
      before,
    });

    return { ok: true };
  });

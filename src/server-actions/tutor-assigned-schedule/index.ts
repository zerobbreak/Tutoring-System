import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { formatTimeRange } from "#/lib/schedule-display";
import { ensureClaimForScheduledSession } from "#/server-actions/lecturer-schedule/ensure-claim-for-session";

const rangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export type TutorAssignedScheduleEventDTO = {
  id: string;
  title: string;
  moduleCode: string;
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  venueLabel: string | null;
  status: string;
  claimId: string | null;
};

export const listTutorAssignedScheduleFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data }): Promise<{ events: TutorAssignedScheduleEventDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: sessions, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select(
        `
        id,
        starts_at,
        ends_at,
        venue_text,
        status,
        venue:venues ( name ),
        module:modules ( code ),
        series:schedule_series ( title )
      `,
      )
      .eq("tutor_id", user.id)
      .gte("starts_at", data.from)
      .lte("starts_at", data.to)
      .neq("status", "CANCELLED")
      .order("starts_at");

    if (sessErr) throw new Error(sessErr.message);

    const sessionIds = (sessions ?? []).map((s) => s.id as string);
    const claimIdBySession = new Map<string, string>();

    if (sessionIds.length) {
      const { data: claims, error: claimErr } = await supabase
        .from("session_claims")
        .select("id, source_scheduled_session_id")
        .in("source_scheduled_session_id", sessionIds);

      if (claimErr) throw new Error(claimErr.message);
      for (const c of claims ?? []) {
        if (c.source_scheduled_session_id) {
          claimIdBySession.set(c.source_scheduled_session_id, c.id as string);
        }
      }
    }

    const events: TutorAssignedScheduleEventDTO[] = [];

    for (const row of sessions ?? []) {
      const id = row.id as string;
      let claimId = claimIdBySession.get(id) ?? null;
      if (!claimId) {
        try {
          claimId = await ensureClaimForScheduledSession(supabase, id);
        } catch {
          claimId = null;
        }
      }

      const module = row.module as { code: string } | null;
      const series = row.series as { title: string } | null;
      const venue = row.venue as { name: string } | null;
      const startsAt = row.starts_at as string;
      const endsAt = row.ends_at as string;
      const venueLabel =
        (row.venue_text as string | null)?.trim() || venue?.name || null;

      events.push({
        id,
        title: series?.title ?? "Session",
        moduleCode: module?.code ?? "",
        startsAt,
        endsAt,
        timeLabel: formatTimeRange(startsAt, endsAt),
        venueLabel,
        status: row.status as string,
        claimId,
      });
    }

    return { events };
  });

const changeRequestSchema = z.object({
  scheduledSessionId: z.string().uuid(),
  proposedStartsAt: z.string().datetime(),
  proposedEndsAt: z.string().datetime(),
  proposedVenueText: z.string().max(255).nullable().optional(),
  reason: z.string().max(2000).optional(),
});

export const submitTutorScheduleChangeRequestFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => changeRequestSchema.parse(input))
  .handler(async ({ data }): Promise<{ requestId: string }> => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: session, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select("id, tutor_id")
      .eq("id", data.scheduledSessionId)
      .maybeSingle();

    if (sessErr) throw new Error(sessErr.message);
    if (!session || session.tutor_id !== user.id) {
      throw new Error("Session not found or access denied.");
    }

    const { data: pending } = await supabase
      .from("schedule_change_requests")
      .select("id")
      .eq("scheduled_session_id", data.scheduledSessionId)
      .eq("status", "PENDING")
      .maybeSingle();

    if (pending?.id) {
      throw new Error("A schedule change request is already pending for this session.");
    }

    const { data: inserted, error: insErr } = await supabase
      .from("schedule_change_requests")
      .insert({
        scheduled_session_id: data.scheduledSessionId,
        requested_by: user.id,
        proposed_starts_at: data.proposedStartsAt,
        proposed_ends_at: data.proposedEndsAt,
        proposed_venue_text: data.proposedVenueText?.trim() || null,
        reason: data.reason?.trim() || null,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { requestId: inserted.id as string };
  });

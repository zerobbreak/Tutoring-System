import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import {
  extendSeriesHorizon,
  needsHorizonExtension,
} from "#/lib/schedule-materialize";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { SCHEDULED_SESSION_SELECT, SERIES_SELECT } from "./constants";
import { mapChangeRequestRow, mapScheduleEventRow, mapSeriesRow } from "./mappers";
import { loadPendingTutorSessionRequestsForLecturer } from "./load-pending-tutor-session-requests";
import type { LecturerSchedulePageDataDTO } from "./types";

const pageDataSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const getLecturerSchedulePageDataFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => pageDataSchema.parse(input))
  .handler(async ({ data }): Promise<LecturerSchedulePageDataDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("lecturer_id", lecturerId)
      .eq("is_active", true)
      .order("code");

    if (modErr) throw new Error(modErr.message);
    const moduleIds = (modules ?? []).map((m) => m.id as string);

    const { data: tutors, error: tutorErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("role", "TUTOR")
      .order("full_name");

    if (tutorErr) throw new Error(tutorErr.message);

    const { data: venues, error: venueErr } = await supabase
      .from("venues")
      .select("id, name, code, capacity, is_active")
      .eq("is_active", true)
      .order("name");

    if (venueErr) throw new Error(venueErr.message);

    const tutorIdsByModule: Record<string, string[]> = {};
    if (moduleIds.length) {
      const { data: assignments, error: assignErr } = await supabase
        .from("tutor_assignments")
        .select("module_id, tutor_id")
        .in("module_id", moduleIds)
        .eq("is_active", true);

      if (assignErr) throw new Error(assignErr.message);
      for (const row of assignments ?? []) {
        const mid = row.module_id as string;
        const tid = row.tutor_id as string;
        if (!tutorIdsByModule[mid]) tutorIdsByModule[mid] = [];
        tutorIdsByModule[mid].push(tid);
      }
    }

    let events: LecturerSchedulePageDataDTO["events"] = [];
    if (moduleIds.length) {
      const { data: sessions, error: sessErr } = await supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .in("module_id", moduleIds)
        .gte("starts_at", data.from)
        .lte("starts_at", data.to)
        .is("deleted_at", null)
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

      events = (sessions ?? []).map((row) =>
        mapScheduleEventRow(row as Parameters<typeof mapScheduleEventRow>[0], claimIdBySession),
      );
    }

    let seriesRows: Parameters<typeof mapSeriesRow>[0][] = [];
    if (moduleIds.length) {
      const { data: rows, error: seriesErr } = await supabase
        .from("schedule_series")
        .select(SERIES_SELECT)
        .in("module_id", moduleIds)
        .order("created_at", { ascending: false });

      if (seriesErr) throw new Error(seriesErr.message);
      seriesRows = (rows ?? []) as Parameters<typeof mapSeriesRow>[0][];

      for (const s of rows ?? []) {
        if (
          s.status === "PUBLISHED" &&
          needsHorizonExtension(s.materialized_until as string | null)
        ) {
          try {
            await extendSeriesHorizon(supabase, s.id as string);
          } catch {
            /* best-effort */
          }
        }
      }
    }

    let pendingChangeRequests: LecturerSchedulePageDataDTO["pendingChangeRequests"] =
      [];

    if (moduleIds.length) {
      const { data: sessionIdsForModules, error: sidErr } = await supabase
        .from("scheduled_sessions")
        .select("id")
        .in("module_id", moduleIds);

      if (sidErr) throw new Error(sidErr.message);

      const sessionIdList = (sessionIdsForModules ?? []).map((s) => s.id as string);

      if (sessionIdList.length) {
        const { data: changeRows, error: changeErr } = await supabase
          .from("schedule_change_requests")
          .select(
            `
            id,
            scheduled_session_id,
            status,
            proposed_starts_at,
            proposed_ends_at,
            proposed_venue_text,
            reason,
            created_at,
            requested_by_user:users!schedule_change_requests_requested_by_fkey ( full_name ),
            session:scheduled_sessions!schedule_change_requests_scheduled_session_id_fkey (
              starts_at,
              ends_at,
              series:schedule_series ( title ),
              module:modules ( code )
            )
          `,
          )
          .eq("status", "PENDING")
          .in("scheduled_session_id", sessionIdList)
          .order("created_at", { ascending: false });

        if (changeErr) throw new Error(changeErr.message);

        pendingChangeRequests = (changeRows ?? []).map((r) =>
          mapChangeRequestRow(r as Parameters<typeof mapChangeRequestRow>[0]),
        );
      }
    }

    const pendingTutorSessionRequests =
      await loadPendingTutorSessionRequestsForLecturer(supabase, moduleIds);

    return {
      modules: (modules ?? []).map((m) => ({
        id: m.id as string,
        code: m.code as string,
        name: m.name as string,
      })),
      tutors: (tutors ?? []).map((t) => ({
        id: t.id as string,
        fullName: t.full_name as string,
        email: t.email as string,
      })),
      tutorIdsByModule,
      venues: (venues ?? []).map((v) => ({
        id: v.id as string,
        name: v.name as string,
        code: (v.code as string | null) ?? null,
        capacity: (v.capacity as number | null) ?? null,
        isActive: v.is_active as boolean,
      })),
      events,
      series: seriesRows.map((s) => mapSeriesRow(s)),
      pendingChangeRequests,
      pendingTutorSessionRequests,
    };
  });

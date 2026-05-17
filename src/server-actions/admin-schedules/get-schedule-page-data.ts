import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  SCHEDULED_SESSION_SELECT,
  SERIES_SELECT,
} from "#/server-actions/lecturer-schedule/constants";
import {
  mapChangeRequestRow,
  mapScheduleEventRow,
  mapSeriesRow,
} from "#/server-actions/lecturer-schedule/mappers";
import {
  getMaxTutorHoursPerWeek,
  parseSchedulingSettings,
  resolveModuleIdsForScope,
} from "./helpers";
import { pageDataSchema } from "./schemas";
import type { AdminSchedulePageDataDTO } from "./types";

export const getAdminSchedulePageDataFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => pageDataSchema.parse(input))
  .handler(async ({ data }): Promise<AdminSchedulePageDataDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const scope = data.scope;
    const scopeEntityId = data.scopeEntityId ?? null;

    const { data: institution, error: instErr } = await supabase
      .from("institutions")
      .select("scheduling_settings")
      .eq("id", institutionId)
      .single();

    if (instErr) throw new Error(instErr.message);
    const maxTutorHoursPerWeek = getMaxTutorHoursPerWeek(
      parseSchedulingSettings(institution?.scheduling_settings),
    );

    const { data: terms, error: termsErr } = await supabase
      .from("academic_terms")
      .select("id, label, academic_year, start_date, end_date, is_current")
      .eq("institution_id", institutionId)
      .order("start_date", { ascending: false });

    if (termsErr) throw new Error(termsErr.message);

    const academicTerms = (terms ?? []).map((t) => ({
      id: t.id as string,
      label: t.label as string,
      academicYear: t.academic_year as string,
      startDate: t.start_date as string,
      endDate: t.end_date as string,
      isCurrent: t.is_current as boolean,
    }));

    const currentTerm =
      academicTerms.find((t) => t.isCurrent) ?? academicTerms[0] ?? null;
    const academicTermId =
      data.academicTermId ?? currentTerm?.id ?? null;

    const moduleIds = await resolveModuleIdsForScope(
      supabase,
      institutionId,
      scope,
      scopeEntityId,
    );

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .order("code");

    if (modErr) throw new Error(modErr.message);

    const { data: tutors, error: tutorErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("institution_id", institutionId)
      .eq("role", "TUTOR")
      .order("full_name");

    if (tutorErr) throw new Error(tutorErr.message);

    const { data: lecturers, error: lecErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("institution_id", institutionId)
      .eq("role", "LECTURER")
      .order("full_name");

    if (lecErr) throw new Error(lecErr.message);

    const { data: venues, error: venueErr } = await supabase
      .from("venues")
      .select("id, name, code, capacity, is_active")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .order("name");

    if (venueErr) throw new Error(venueErr.message);

    const tutorIdsByModule: Record<string, string[]> = {};
    const allModuleIds = (modules ?? []).map((m) => m.id as string);

    if (allModuleIds.length) {
      const { data: assignments, error: assignErr } = await supabase
        .from("tutor_assignments")
        .select("module_id, tutor_id")
        .in("module_id", allModuleIds)
        .eq("is_active", true);

      if (assignErr) throw new Error(assignErr.message);
      for (const row of assignments ?? []) {
        const mid = row.module_id as string;
        const tid = row.tutor_id as string;
        if (!tutorIdsByModule[mid]) tutorIdsByModule[mid] = [];
        tutorIdsByModule[mid].push(tid);
      }
    }

    let events: AdminSchedulePageDataDTO["events"] = [];
    if (moduleIds.length) {
      let sessionQuery = supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .in("module_id", moduleIds)
        .gte("starts_at", data.from)
        .lte("starts_at", data.to)
        .is("deleted_at", null)
        .order("starts_at");

      if (scope === "tutor" && scopeEntityId) {
        sessionQuery = sessionQuery.eq("tutor_id", scopeEntityId);
      }

      const { data: sessions, error: sessErr } = await sessionQuery;
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
            claimIdBySession.set(
              c.source_scheduled_session_id as string,
              c.id as string,
            );
          }
        }
      }

      events = (sessions ?? []).map((row) =>
        mapScheduleEventRow(
          row as unknown as Parameters<typeof mapScheduleEventRow>[0],
          claimIdBySession,
        ),
      );
    }

    let seriesRows: Parameters<typeof mapSeriesRow>[0][] = [];
    if (moduleIds.length) {
      let seriesQuery = supabase
        .from("schedule_series")
        .select(SERIES_SELECT)
        .in("module_id", moduleIds)
        .order("created_at", { ascending: false });

      if (academicTermId) {
        seriesQuery = seriesQuery.or(
          `academic_term_id.eq.${academicTermId},academic_term_id.is.null`,
        );
      }

      const { data: rows, error: seriesErr } = await seriesQuery;
      if (seriesErr) throw new Error(seriesErr.message);
      seriesRows = (rows ?? []) as unknown as Parameters<typeof mapSeriesRow>[0][];
    }

    let pendingChangeRequests: AdminSchedulePageDataDTO["pendingChangeRequests"] =
      [];

    if (moduleIds.length) {
      const { data: sessionIdsForModules, error: sidErr } = await supabase
        .from("scheduled_sessions")
        .select("id")
        .in("module_id", moduleIds);

      if (sidErr) throw new Error(sidErr.message);

      const sessionIdList = (sessionIdsForModules ?? []).map(
        (s) => s.id as string,
      );

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
          mapChangeRequestRow(
            r as unknown as Parameters<typeof mapChangeRequestRow>[0],
          ),
        );
      }
    }

    const mappedSeries = seriesRows.map((s) => mapSeriesRow(s));
    let seriesIdsNeedingClaimSync: string[] = [];

    const publishedSeriesIds = seriesRows
      .filter((row) => row.status === "PUBLISHED")
      .map((row) => row.id as string);

    if (publishedSeriesIds.length) {
      const { data: publishedSessions, error: psErr } = await supabase
        .from("scheduled_sessions")
        .select("id, series_id")
        .in("series_id", publishedSeriesIds);

      if (psErr) throw new Error(psErr.message);

      const sessionIds = (publishedSessions ?? []).map((s) => s.id as string);
      if (sessionIds.length) {
        const { data: claims, error: claimsErr } = await supabase
          .from("session_claims")
          .select("source_scheduled_session_id")
          .in("source_scheduled_session_id", sessionIds);

        if (claimsErr) throw new Error(claimsErr.message);

        const claimedSessionIds = new Set(
          (claims ?? [])
            .map((c) => c.source_scheduled_session_id as string | null)
            .filter((id): id is string => Boolean(id)),
        );

        const seriesMissingClaims = new Set<string>();
        for (const session of publishedSessions ?? []) {
          if (!claimedSessionIds.has(session.id as string)) {
            seriesMissingClaims.add(session.series_id as string);
          }
        }
        seriesIdsNeedingClaimSync = [...seriesMissingClaims];
      }
    }

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
      lecturers: (lecturers ?? []).map((l) => ({
        id: l.id as string,
        fullName: l.full_name as string,
        email: l.email as string,
      })),
      academicTerms,
      currentTermId: currentTerm?.id ?? null,
      maxTutorHoursPerWeek,
      tutorIdsByModule,
      venues: (venues ?? []).map((v) => ({
        id: v.id as string,
        name: v.name as string,
        code: (v.code as string | null) ?? null,
        capacity: (v.capacity as number | null) ?? null,
        isActive: v.is_active as boolean,
      })),
      events,
      series: mappedSeries,
      seriesIdsNeedingClaimSync,
      pendingChangeRequests,
      scope,
      scopeEntityId,
    };
  });

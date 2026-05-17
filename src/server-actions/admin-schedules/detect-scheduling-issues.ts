import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import {
  detectAllSchedulingIssues,
  type ScheduleSessionLike,
} from "#/lib/schedule-conflicts";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { SCHEDULED_SESSION_SELECT } from "#/server-actions/lecturer-schedule/constants";
import {
  getMaxTutorHoursPerWeek,
  parseSchedulingSettings,
  resolveModuleIdsForScope,
} from "./helpers";
import { issuesSchema } from "./schemas";
import type { DetectSchedulingIssuesResultDTO } from "./types";

export const detectSchedulingIssuesFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => issuesSchema.parse(input))
  .handler(async ({ data }): Promise<DetectSchedulingIssuesResultDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: institution, error: instErr } = await supabase
      .from("institutions")
      .select("scheduling_settings")
      .eq("id", institutionId)
      .single();

    if (instErr) throw new Error(instErr.message);
    const maxTutorHoursPerWeek = getMaxTutorHoursPerWeek(
      parseSchedulingSettings(institution?.scheduling_settings),
    );

    const scope = data.scope;
    const scopeEntityId = data.scopeEntityId ?? null;

    const { data: terms } = await supabase
      .from("academic_terms")
      .select("id, is_current")
      .eq("institution_id", institutionId)
      .order("start_date", { ascending: false });

    const currentTerm =
      (terms ?? []).find((t) => t.is_current) ?? terms?.[0] ?? null;
    const academicTermId =
      data.academicTermId ?? (currentTerm?.id as string | undefined) ?? null;

    const moduleIds = await resolveModuleIdsForScope(
      supabase,
      institutionId,
      scope,
      scopeEntityId,
    );

    let sessions: ScheduleSessionLike[] = [];
    if (moduleIds.length) {
      let sessionQuery = supabase
        .from("scheduled_sessions")
        .select(SCHEDULED_SESSION_SELECT)
        .in("module_id", moduleIds)
        .gte("starts_at", data.from)
        .lte("starts_at", data.to);

      if (scope === "tutor" && scopeEntityId) {
        sessionQuery = sessionQuery.eq("tutor_id", scopeEntityId);
      }

      const { data: rows, error: sessErr } = await sessionQuery;
      if (sessErr) throw new Error(sessErr.message);

      sessions = (rows ?? []).map((row) => {
        const r = row as unknown as {
          id: string;
          tutor_id: string;
          venue_id: string | null;
          module_id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          tutor: { full_name: string } | null;
          venue: { name: string } | null;
          module: { code: string } | null;
        };
        return {
          id: r.id,
          tutorId: r.tutor_id,
          tutorName: r.tutor?.full_name ?? "",
          venueId: r.venue_id,
          venueName: r.venue?.name ?? null,
          moduleId: r.module_id,
          moduleCode: r.module?.code ?? "",
          startsAt: r.starts_at,
          endsAt: r.ends_at,
          status: r.status,
        };
      });
    }

    const assignments: {
      moduleId: string;
      moduleCode: string;
      tutorId: string;
      tutorName: string;
    }[] = [];

    if (moduleIds.length) {
      const { data: assignRows, error: assignErr } = await supabase
        .from("tutor_assignments")
        .select(
          `
          module_id,
          tutor_id,
          module:modules ( code ),
          tutor:users!tutor_assignments_tutor_id_fkey ( full_name )
        `,
        )
        .in("module_id", moduleIds)
        .eq("is_active", true);

      if (assignErr) throw new Error(assignErr.message);

      for (const row of assignRows ?? []) {
        const r = row as unknown as {
          module_id: string;
          tutor_id: string;
          module: { code: string } | null;
          tutor: { full_name: string } | null;
        };
        if (scope === "tutor" && scopeEntityId && r.tutor_id !== scopeEntityId) {
          continue;
        }
        assignments.push({
          moduleId: r.module_id,
          moduleCode: r.module?.code ?? "",
          tutorId: r.tutor_id,
          tutorName: r.tutor?.full_name ?? "Tutor",
        });
      }
    }

    let publishedSeries: {
      moduleId: string;
      tutorId: string;
      status: string;
      academicTermId: string | null;
    }[] = [];

    if (moduleIds.length) {
      let seriesQuery = supabase
        .from("schedule_series")
        .select("module_id, tutor_id, status, academic_term_id")
        .in("module_id", moduleIds);

      if (academicTermId) {
        seriesQuery = seriesQuery.or(
          `academic_term_id.eq.${academicTermId},academic_term_id.is.null`,
        );
      }

      const { data: seriesRows, error: seriesErr } = await seriesQuery;
      if (seriesErr) throw new Error(seriesErr.message);

      publishedSeries = (seriesRows ?? []).map((s) => ({
        moduleId: s.module_id as string,
        tutorId: s.tutor_id as string,
        status: s.status as string,
        academicTermId: (s.academic_term_id as string | null) ?? null,
      }));
    }

    const issues = detectAllSchedulingIssues({
      sessions,
      assignments,
      publishedSeries,
      maxHoursPerWeek: maxTutorHoursPerWeek,
      academicTermId,
    });

    return { issues, maxTutorHoursPerWeek };
  });

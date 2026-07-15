import { createServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import {
  computeTutorStats,
  groupClaimsByMonth,
  isTutorInactive,
  type ClaimStatsRow,
} from "./compute-tutor-stats";
import type {
  LecturerTutorDetailDTO,
  TutorAttendancePointDTO,
  TutorModuleAssignmentDTO,
  TutorWorkloadPointDTO,
} from "./types";

const tutorIdSchema = z.object({
  tutorId: z.string().uuid(),
});

const CLAIM_STATS_SELECT = `
  id,
  tutor_id,
  status,
  submitted_at,
  attendance_present_count,
  attendance_expected_count,
  hours,
  session_date,
  updated_at,
  source_scheduled_session_id
`;

export const getLecturerTutorDetailFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => tutorIdSchema.parse(input))
  .handler(async ({ data }): Promise<LecturerTutorDetailDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const now = new Date();

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id")
      .eq("lecturer_id", lecturerId);

    if (modErr) throw new Error(modErr.message);
    const moduleIds = (modules ?? []).map((m) => m.id as string);
    if (!moduleIds.length) {
      throw new Error("No modules found.");
    }

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id, full_name, email, is_active, last_login_at")
      .eq("id", data.tutorId)
      .maybeSingle();

    if (userErr) throw new Error(userErr.message);
    if (!userRow) throw new Error("Tutor not found.");

    const [assignmentsRes, claimsRes, upcomingRes, cancelledRes] =
      await Promise.all([
        supabase
          .from("tutor_assignments")
          .select(
            `
            id,
            module_id,
            tutor_id,
            start_date,
            end_date,
            is_active,
            module:modules ( id, code, name )
          `,
          )
          .eq("tutor_id", data.tutorId)
          .in("module_id", moduleIds),
        supabase
          .from("session_claims")
          .select(CLAIM_STATS_SELECT)
          .eq("tutor_id", data.tutorId)
          .in("module_id", moduleIds),
        supabase
          .from("scheduled_sessions")
          .select("id", { count: "exact", head: true })
          .eq("tutor_id", data.tutorId)
          .in("module_id", moduleIds)
          .neq("status", "CANCELLED")
          .gte("starts_at", now.toISOString()),
        supabase
          .from("scheduled_sessions")
          .select("id", { count: "exact", head: true })
          .eq("tutor_id", data.tutorId)
          .in("module_id", moduleIds)
          .eq("status", "CANCELLED"),
      ]);

    if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
    if (claimsRes.error) throw new Error(claimsRes.error.message);
    if (upcomingRes.error) throw new Error(upcomingRes.error.message);
    if (cancelledRes.error) throw new Error(cancelledRes.error.message);

    const claims = (claimsRes.data ?? []) as ClaimStatsRow[];
    const claimIds = claims.map((c) => c.id);

    let disputeCount = 0;
    let openDisputes = 0;
    if (claimIds.length) {
      const { data: disputes, error: dispErr } = await supabase
        .from("disputes")
        .select("id, status")
        .in("claim_id", claimIds);
      if (dispErr) throw new Error(dispErr.message);
      disputeCount = disputes?.length ?? 0;
      openDisputes =
        disputes?.filter((d) => d.status === "OPEN").length ?? 0;
    }

    const stats = computeTutorStats(claims);
    const byMonth = groupClaimsByMonth(claims);
    const monthKeys = [...byMonth.keys()].sort();

    const workloadByMonth: TutorWorkloadPointDTO[] = monthKeys.map((key) => {
      const monthClaims = byMonth.get(key) ?? [];
      const hours = monthClaims.reduce((sum, c) => {
        const raw = c.hours;
        const h = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
        return sum + (Number.isFinite(h) ? h : 0);
      }, 0);
      return {
        label: format(parseISO(`${key}-01`), "MMM yyyy"),
        sessionCount: monthClaims.length,
        hours,
      };
    });

    const attendanceByMonth: TutorAttendancePointDTO[] = monthKeys.map(
      (key) => {
        const monthClaims = byMonth.get(key) ?? [];
        let sum = 0;
        let count = 0;
        for (const c of monthClaims) {
          const p = c.attendance_present_count;
          const e = c.attendance_expected_count;
          if (p != null && e != null && e > 0 && c.status !== "DRAFT") {
            sum += p / e;
            count++;
          }
        }
        return {
          label: format(parseISO(`${key}-01`), "MMM yyyy"),
          average: count > 0 ? sum / count : 0,
        };
      },
    );

    const assignedModules: TutorModuleAssignmentDTO[] = (
      assignmentsRes.data ?? []
    ).map((row) => {
      const mod = unwrapOne(
        row.module as
          | { id: string; code: string; name: string }
          | { id: string; code: string; name: string }[]
          | null,
      );
      return {
        assignmentId: row.id as string,
        moduleId: mod?.id ?? (row.module_id as string),
        moduleCode: mod?.code ?? "",
        moduleName: mod?.name ?? "",
        startDate: row.start_date as string,
        endDate: (row.end_date as string | null) ?? null,
        isActive: row.is_active as boolean,
      };
    });

    const hasAccess =
      assignedModules.length > 0 || claims.length > 0;
    if (!hasAccess) {
      throw new Error("Tutor not found on your modules.");
    }

    return {
      id: userRow.id as string,
      fullName: userRow.full_name as string,
      email: userRow.email as string,
      isActive: (userRow.is_active as boolean) ?? true,
      lastLoginAt: (userRow.last_login_at as string | null) ?? null,
      isInactive: isTutorInactive(
        (userRow.is_active as boolean) ?? true,
        (userRow.last_login_at as string | null) ?? null,
        stats.lastActivityAt,
        now,
      ),
      assignedModules: assignedModules.filter((a) => a.isActive),
      sessionsCompleted: stats.sessionsCompleted,
      attendanceAverage: stats.attendanceAverage,
      approvalRate: stats.approvalRate,
      pendingClaims: stats.pendingClaims,
      rejectedClaims: stats.rejectedClaims,
      disputedClaims: stats.disputedClaims,
      totalHours: stats.totalHours,
      disputeCount,
      openDisputes,
      upcomingSessions: upcomingRes.count ?? 0,
      cancelledSessions: cancelledRes.count ?? 0,
      scheduleLinkedRate:
        stats.nonDraftCount > 0
          ? stats.scheduleLinkedCount / stats.nonDraftCount
          : null,
      workloadByMonth,
      attendanceByMonth,
      recentClaimIds: stats.recentClaimIds,
    };
  });

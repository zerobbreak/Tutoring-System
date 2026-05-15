import { createServerFn } from "@tanstack/react-start";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import {
  computeTutorStats,
  isTutorInactive,
  type ClaimStatsRow,
} from "./compute-tutor-stats";
import type {
  LecturerTutorCardDTO,
  LecturerTutorsPageDataDTO,
  TutorModuleAssignmentDTO,
} from "./types";

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

export const listLecturerTutorsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LecturerTutorsPageDataDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const now = new Date();

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("lecturer_id", lecturerId)
      .order("code");

    if (modErr) throw new Error(modErr.message);
    const moduleRows = (modules ?? []).map((m) => ({
      id: m.id as string,
      code: m.code as string,
      name: m.name as string,
    }));
    const moduleIds = moduleRows.map((m) => m.id);

    if (!moduleIds.length) {
      return { tutors: [], modules: moduleRows };
    }

    const [assignmentsRes, claimsRes, upcomingRes] = await Promise.all([
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
            module:modules ( id, code, name ),
            tutor:users ( id, full_name, email, is_active, last_login_at )
          `,
        )
        .in("module_id", moduleIds),
      supabase
        .from("session_claims")
        .select(CLAIM_STATS_SELECT)
        .in("module_id", moduleIds),
      supabase
        .from("scheduled_sessions")
        .select("id, tutor_id")
        .in("module_id", moduleIds)
        .neq("status", "CANCELLED")
        .gte("starts_at", now.toISOString()),
    ]);

    if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
    if (claimsRes.error) throw new Error(claimsRes.error.message);
    if (upcomingRes.error) throw new Error(upcomingRes.error.message);

    const claimsByTutor = new Map<string, ClaimStatsRow[]>();
    const claimIdToTutor = new Map<string, string>();
    for (const row of claimsRes.data ?? []) {
      const tid = row.tutor_id as string;
      const claim = row as ClaimStatsRow;
      claimIdToTutor.set(claim.id, tid);
      const list = claimsByTutor.get(tid) ?? [];
      list.push(claim);
      claimsByTutor.set(tid, list);
    }

    const disputeCountByTutor = new Map<string, number>();
    const claimIds = [...claimIdToTutor.keys()];
    if (claimIds.length) {
      const { data: disputes, error: dispErr } = await supabase
        .from("disputes")
        .select("id, claim_id")
        .in("claim_id", claimIds);
      if (dispErr) throw new Error(dispErr.message);
      for (const d of disputes ?? []) {
        const tid = claimIdToTutor.get(d.claim_id as string);
        if (!tid) continue;
        disputeCountByTutor.set(tid, (disputeCountByTutor.get(tid) ?? 0) + 1);
      }
    }

    const upcomingByTutor = new Map<string, number>();
    for (const s of upcomingRes.data ?? []) {
      const tid = s.tutor_id as string;
      upcomingByTutor.set(tid, (upcomingByTutor.get(tid) ?? 0) + 1);
    }

    type TutorAcc = {
      id: string;
      fullName: string;
      email: string;
      isActive: boolean;
      lastLoginAt: string | null;
      assignments: TutorModuleAssignmentDTO[];
    };

    const tutorMap = new Map<string, TutorAcc>();

    for (const row of assignmentsRes.data ?? []) {
      const tutor = unwrapOne(
        row.tutor as
          | {
              id: string;
              full_name: string;
              email: string;
              is_active: boolean;
              last_login_at: string | null;
            }
          | {
              id: string;
              full_name: string;
              email: string;
              is_active: boolean;
              last_login_at: string | null;
            }[]
          | null,
      );
      const mod = unwrapOne(
        row.module as
          | { id: string; code: string; name: string }
          | { id: string; code: string; name: string }[]
          | null,
      );
      if (!tutor || !mod) continue;

      const tid = tutor.id;
      let acc = tutorMap.get(tid);
      if (!acc) {
        acc = {
          id: tid,
          fullName: tutor.full_name,
          email: tutor.email,
          isActive: tutor.is_active ?? true,
          lastLoginAt: tutor.last_login_at,
          assignments: [],
        };
        tutorMap.set(tid, acc);
      }

      acc.assignments.push({
        assignmentId: row.id as string,
        moduleId: mod.id,
        moduleCode: mod.code,
        moduleName: mod.name,
        startDate: row.start_date as string,
        endDate: (row.end_date as string | null) ?? null,
        isActive: row.is_active as boolean,
      });
    }

    const missingTutorIds = [...claimsByTutor.keys()].filter(
      (id) => !tutorMap.has(id),
    );
    if (missingTutorIds.length) {
      const { data: userRows, error: userErr } = await supabase
        .from("users")
        .select("id, full_name, email, is_active, last_login_at")
        .in("id", missingTutorIds);
      if (userErr) throw new Error(userErr.message);
      for (const userRow of userRows ?? []) {
        tutorMap.set(userRow.id as string, {
          id: userRow.id as string,
          fullName: userRow.full_name as string,
          email: userRow.email as string,
          isActive: (userRow.is_active as boolean) ?? true,
          lastLoginAt: (userRow.last_login_at as string | null) ?? null,
          assignments: [],
        });
      }
    }

    const tutors: LecturerTutorCardDTO[] = [...tutorMap.values()]
      .map((acc) => {
        const claims = claimsByTutor.get(acc.id) ?? [];
        const stats = computeTutorStats(claims);
        return {
          id: acc.id,
          fullName: acc.fullName,
          email: acc.email,
          isActive: acc.isActive,
          lastLoginAt: acc.lastLoginAt,
          isInactive: isTutorInactive(
            acc.isActive,
            acc.lastLoginAt,
            stats.lastActivityAt,
            now,
          ),
          assignedModules: acc.assignments.filter((a) => a.isActive),
          sessionsCompleted: stats.sessionsCompleted,
          attendanceAverage: stats.attendanceAverage,
          approvalRate: stats.approvalRate,
          pendingClaims: stats.pendingClaims,
          totalHours: stats.totalHours,
          disputeCount: disputeCountByTutor.get(acc.id) ?? 0,
          upcomingSessions: upcomingByTutor.get(acc.id) ?? 0,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return { tutors, modules: moduleRows };
  },
);

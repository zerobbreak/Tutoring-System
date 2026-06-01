import {
  endOfWeek,
  format,
  startOfWeek,
  subDays,
} from "date-fns";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  ANALYTICS_LOOKBACK_DAYS,
  CLAIM_ANALYTICS_SELECT,
} from "#/server-actions/lecturer-analytics/constants";
import {
  buildHeatmapWeekStarts,
  firstApproveByClaim,
  type ClaimRow,
  type VerificationActionRow,
} from "#/server-actions/lecturer-analytics/helpers";
import type {
  AdminAnalyticsBuildContext,
  AdminAnalyticsLoadResult,
  AdminModuleRow,
  CampusRow,
  OnboardingRow,
  PipelineClaimRow,
  ScheduledSessionRow,
  TermRow,
  TutorUserRow,
} from "./admin-analytics-context";
import {
  buildSubmittedByClaim,
  buildWorkflowStageTimings,
  firstAdminApprovedByClaim,
  firstVerifiedByClaim,
} from "./workflow-stages";

export async function loadAdminAnalyticsData(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  institutionId: string,
): Promise<AdminAnalyticsLoadResult> {
  const now = new Date();
  const trendFrom = format(subDays(now, ANALYTICS_LOOKBACK_DAYS), "yyyy-MM-dd");
  const scheduleFrom = subDays(now, ANALYTICS_LOOKBACK_DAYS).toISOString();
  const actionsFrom = subDays(now, ANALYTICS_LOOKBACK_DAYS).toISOString();
  const disputesFrom = subDays(now, ANALYTICS_LOOKBACK_DAYS).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const { data: institution, error: instErr } = await supabase
    .from("institutions")
    .select("name")
    .eq("id", institutionId)
    .maybeSingle();
  if (instErr) throw new Error(instErr.message);

  const { data: modules, error: modErr } = await supabase
    .from("modules")
    .select("id, code, name, lecturer_id, academic_term_id")
    .eq("institution_id", institutionId)
    .order("code", { ascending: true });
  if (modErr) throw new Error(modErr.message);

  const moduleRows: AdminModuleRow[] = (modules ?? []).map((m) => ({
    id: m.id as string,
    code: m.code as string,
    name: m.name as string,
    lecturerId: m.lecturer_id as string,
    academicTermId: (m.academic_term_id as string | null) ?? null,
  }));
  const moduleIds = moduleRows.map((m) => m.id);
  const moduleIdToTerm = new Map(
    moduleRows.map((m) => [m.id, m.academicTermId]),
  );

  if (!moduleIds.length) {
    return {
      kind: "empty",
      institutionName: (institution?.name as string | null) ?? null,
    };
  }

  const lecturerIds = [...new Set(moduleRows.map((m) => m.lecturerId))];

  const [
    claimsRes,
    pipelineClaimsRes,
    disputesRes,
    openDisputesRes,
    actionsRes,
    scheduledRes,
    pendingVerifyRes,
    pendingAdminRes,
    weekScheduledRes,
    termsRes,
    campusesRes,
    onboardingRes,
    tutorUsersRes,
  ] = await Promise.all([
    supabase
      .from("session_claims")
      .select(CLAIM_ANALYTICS_SELECT)
      .in("module_id", moduleIds)
      .gte("session_date", trendFrom)
      .order("session_date", { ascending: true }),
    supabase
      .from("session_claims")
      .select("id, status, submitted_at, module_id, tutor_id")
      .in("module_id", moduleIds),
    supabase
      .from("disputes")
      .select("id, claim_id, status, raised_at")
      .gte("raised_at", disputesFrom)
      .order("raised_at", { ascending: false }),
    supabase
      .from("disputes")
      .select("claim_id")
      .eq("status", "OPEN"),
    supabase
      .from("verification_actions")
      .select("claim_id, actor_id, action_type, to_status, acted_at")
      .gte("acted_at", actionsFrom)
      .order("acted_at", { ascending: true }),
    supabase
      .from("scheduled_sessions")
      .select("id, module_id, status, venue_id")
      .in("module_id", moduleIds)
      .neq("status", "CANCELLED")
      .gte("starts_at", scheduleFrom),
    supabase
      .from("session_claims")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds)
      .eq("status", "PENDING_VERIFICATION"),
    supabase
      .from("session_claims")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds)
      .eq("status", "VERIFIED"),
    supabase
      .from("scheduled_sessions")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds)
      .neq("status", "CANCELLED")
      .gte("starts_at", weekStart.toISOString())
      .lte("starts_at", weekEnd.toISOString()),
    supabase
      .from("academic_terms")
      .select("id, label, academic_year")
      .eq("institution_id", institutionId)
      .order("start_date", { ascending: false }),
    supabase
      .from("campuses")
      .select("id, name, code")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("users")
      .select("user_status, onboarding_step, role")
      .eq("institution_id", institutionId)
      .in("role", ["TUTOR", "LECTURER"]),
    supabase
      .from("users")
      .select("id, full_name, last_login_at, is_active")
      .eq("institution_id", institutionId)
      .eq("role", "TUTOR"),
  ]);

  const errors = [
    claimsRes.error,
    pipelineClaimsRes.error,
    disputesRes.error,
    openDisputesRes.error,
    actionsRes.error,
    scheduledRes.error,
    pendingVerifyRes.error,
    pendingAdminRes.error,
    weekScheduledRes.error,
    termsRes.error,
    campusesRes.error,
    onboardingRes.error,
    tutorUsersRes.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((e) => e!.message).join(" · "));
  }

  const claims = (claimsRes.data ?? []) as ClaimRow[];
  const pipelineClaims = (pipelineClaimsRes.data ?? []) as PipelineClaimRow[];
  const institutionClaimIds = new Set(pipelineClaims.map((c) => c.id));
  const claimIdToModule = new Map(
    pipelineClaims.map((c) => [c.id, c.module_id]),
  );
  const claimIdToTutor = new Map(
    pipelineClaims.map((c) => [c.id, c.tutor_id]),
  );

  const disputes = (disputesRes.data ?? []).filter((d) =>
    institutionClaimIds.has(d.claim_id as string),
  ) as AdminAnalyticsBuildContext["disputes"];
  const openDisputes = (openDisputesRes.data ?? []).filter((d) =>
    institutionClaimIds.has(d.claim_id as string),
  ).length;
  const disputeCountInPeriod = disputes.length;

  const allActions = (actionsRes.data ?? []) as VerificationActionRow[];
  const claimActions = allActions.filter((a) =>
    institutionClaimIds.has(a.claim_id),
  );
  const firstApproveAt = firstApproveByClaim(claimActions);
  const verifiedAt = firstVerifiedByClaim(claimActions);
  const adminApprovedAt = firstAdminApprovedByClaim(claimActions);
  const submittedByClaim = buildSubmittedByClaim(
    pipelineClaims.map((c) => ({
      id: c.id,
      submitted_at: c.submitted_at,
    })),
  );
  const stageTimings = buildWorkflowStageTimings(
    submittedByClaim,
    verifiedAt,
    adminApprovedAt,
  );

  const tutorNameById = new Map<string, string>();
  const tutorLoginById = new Map<string, string | null>();
  const tutorUsers = (tutorUsersRes.data ?? []) as TutorUserRow[];
  for (const u of tutorUsers) {
    tutorNameById.set(u.id, u.full_name);
    tutorLoginById.set(u.id, u.last_login_at);
  }

  const tutorIds = [...new Set(claims.map((c) => c.tutor_id))];
  if (tutorIds.length) {
    const missing = tutorIds.filter((id) => !tutorNameById.has(id));
    if (missing.length) {
      const { data: extraTutors, error: exErr } = await supabase
        .from("users")
        .select("id, full_name, last_login_at")
        .in("id", missing);
      if (exErr) throw new Error(exErr.message);
      for (const u of extraTutors ?? []) {
        tutorNameById.set(u.id as string, u.full_name as string);
        tutorLoginById.set(u.id as string, u.last_login_at as string | null);
      }
    }
  }

  const lecturerNameById = new Map<string, string>();
  if (lecturerIds.length) {
    const { data: lecturerUsers, error: lecErr } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", lecturerIds);
    if (lecErr) throw new Error(lecErr.message);
    for (const u of lecturerUsers ?? []) {
      lecturerNameById.set(u.id as string, u.full_name as string);
    }
  }

  const scheduledSessions = (scheduledRes.data ?? []) as ScheduledSessionRow[];
  const scheduledExpected = scheduledSessions.length;
  const scheduledIds = new Set(scheduledSessions.map((s) => s.id));
  const scheduledCompleted = claims.filter(
    (c) =>
      c.source_scheduled_session_id &&
      scheduledIds.has(c.source_scheduled_session_id) &&
      c.status !== "DRAFT",
  ).length;
  const scheduleCompletionRate =
    scheduledExpected > 0 ? scheduledCompleted / scheduledExpected : null;

  const pendingVerificationCount = pendingVerifyRes.count ?? 0;
  const pendingAdminApprovals = pendingAdminRes.count ?? 0;
  const weekScheduledCount = weekScheduledRes.count ?? 0;

  const disputeCountByTutor = new Map<string, number>();
  const disputeCountByModule = new Map<string, number>();
  for (const d of disputes) {
    const cid = d.claim_id;
    const tid = claimIdToTutor.get(cid);
    const mid = claimIdToModule.get(cid);
    if (tid) {
      disputeCountByTutor.set(tid, (disputeCountByTutor.get(tid) ?? 0) + 1);
    }
    if (mid) {
      disputeCountByModule.set(mid, (disputeCountByModule.get(mid) ?? 0) + 1);
    }
  }

  const claimsByTutor = new Map<string, ClaimRow[]>();
  const claimsByModule = new Map<string, ClaimRow[]>();
  for (const claim of claims) {
    const tList = claimsByTutor.get(claim.tutor_id) ?? [];
    tList.push(claim);
    claimsByTutor.set(claim.tutor_id, tList);

    const mList = claimsByModule.get(claim.module_id) ?? [];
    mList.push(claim);
    claimsByModule.set(claim.module_id, mList);
  }

  const scheduledByModule = new Map<string, number>();
  const completedByModule = new Map<string, number>();
  for (const s of scheduledSessions) {
    scheduledByModule.set(s.module_id, (scheduledByModule.get(s.module_id) ?? 0) + 1);
  }
  for (const c of claims) {
    if (
      !c.source_scheduled_session_id ||
      !scheduledIds.has(c.source_scheduled_session_id) ||
      c.status === "DRAFT"
    ) {
      continue;
    }
    completedByModule.set(
      c.module_id,
      (completedByModule.get(c.module_id) ?? 0) + 1,
    );
  }

  const weekStarts = buildHeatmapWeekStarts(now);
  const termRows = (termsRes.data ?? []) as TermRow[];
  const campusRows = (campusesRes.data ?? []) as CampusRow[];
  const onboardingRows = (onboardingRes.data ?? []) as OnboardingRow[];

  return {
    kind: "loaded",
    ctx: {
      supabase,
      institutionId,
      now,
      institutionName: (institution?.name as string | null) ?? null,
      moduleRows,
      moduleIds,
      moduleIdToTerm,
      lecturerIds,
      claims,
      pipelineClaims,
      institutionClaimIds,
      claimIdToModule,
      claimIdToTutor,
      disputes,
      openDisputes,
      disputeCountInPeriod,
      claimActions,
      firstApproveAt,
      verifiedAt,
      adminApprovedAt,
      submittedByClaim,
      stageTimings,
      tutorNameById,
      tutorLoginById,
      lecturerNameById,
      scheduledSessions,
      scheduledExpected,
      scheduledIds,
      scheduledCompleted,
      scheduleCompletionRate,
      pendingVerificationCount,
      pendingAdminApprovals,
      weekScheduledCount,
      disputeCountByTutor,
      disputeCountByModule,
      claimsByTutor,
      claimsByModule,
      scheduledByModule,
      completedByModule,
      weekStarts,
      termRows,
      campusRows,
      onboardingRows,
      tutorUsers,
    },
  };
}

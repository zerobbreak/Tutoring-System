import {
  computeTutorStats,
  isTutorInactive,
  type ClaimStatsRow,
} from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import type { AdminAnalyticsBuildContext } from "./admin-analytics-context";
import type {
  InstitutionSnapshotDTO,
  OnboardingAnalyticsDTO,
} from "./types";
import { mapOnboardingCounts } from "./workflow-stages";

export async function buildAdminInstitutionSnapshot(
  ctx: AdminAnalyticsBuildContext,
): Promise<{
  institution: InstitutionSnapshotDTO;
  onboarding: OnboardingAnalyticsDTO;
}> {
  let activeTutors = 0;
  if (ctx.tutorUsers.length) {
    const { data: allTutorClaims, error: atcErr } = await ctx.supabase
      .from("session_claims")
      .select(
        "id, tutor_id, status, submitted_at, attendance_present_count, attendance_expected_count, hours, session_date, updated_at, source_scheduled_session_id",
      )
      .in("module_id", ctx.moduleIds)
      .in(
        "tutor_id",
        ctx.tutorUsers.map((t) => t.id),
      );
    if (atcErr) throw new Error(atcErr.message);

    const claimsByTutorAll = new Map<string, ClaimStatsRow[]>();
    for (const row of allTutorClaims ?? []) {
      const tid = row.tutor_id as string;
      const list = claimsByTutorAll.get(tid) ?? [];
      list.push(row as ClaimStatsRow);
      claimsByTutorAll.set(tid, list);
    }

    for (const tutor of ctx.tutorUsers) {
      const stats = computeTutorStats(claimsByTutorAll.get(tutor.id) ?? []);
      if (
        !isTutorInactive(
          tutor.is_active,
          tutor.last_login_at,
          stats.lastActivityAt,
          ctx.now,
        )
      ) {
        activeTutors += 1;
      }
    }
  }

  const scheduleCompletionRate = ctx.scheduleCompletionRate;

  return {
    institution: {
      activeScheduledSessions: ctx.weekScheduledCount,
      utilizationRate:
        scheduleCompletionRate != null
          ? Math.round(scheduleCompletionRate * 100) / 100
          : null,
      totalModules: ctx.moduleRows.length,
      activeTutors,
    },
    onboarding: {
      tutors: mapOnboardingCounts(ctx.onboardingRows, "TUTOR"),
      lecturers: mapOnboardingCounts(ctx.onboardingRows, "LECTURER"),
    },
  };
}

import { median, turnaroundHours } from "#/server-actions/lecturer-analytics/helpers";
import type { AdminAnalyticsBuildContext } from "./admin-analytics-context";
import type { LecturerAnalyticsRowDTO } from "./types";

export function buildAdminLecturerAnalytics(
  ctx: AdminAnalyticsBuildContext,
): LecturerAnalyticsRowDTO[] {
  const modulesByLecturer = new Map<string, string[]>();
  for (const mod of ctx.moduleRows) {
    const list = modulesByLecturer.get(mod.lecturerId) ?? [];
    list.push(mod.id);
    modulesByLecturer.set(mod.lecturerId, list);
  }

  return ctx.lecturerIds
    .map((lecturerId) => {
      const modIds = modulesByLecturer.get(lecturerId) ?? [];
      const lecClaims = ctx.claims.filter((c) => modIds.includes(c.module_id));
      let pendingVerificationCount = 0;
      const verifyHours: number[] = [];
      let verificationActionsCount = 0;

      for (const c of lecClaims) {
        if (c.status === "PENDING_VERIFICATION") {
          pendingVerificationCount += 1;
        }
        if (c.submitted_at) {
          const verified = ctx.verifiedAt.get(c.id);
          if (verified) {
            verifyHours.push(turnaroundHours(c.submitted_at, verified));
          }
        }
      }

      for (const action of ctx.claimActions) {
        if (action.actor_id === lecturerId) {
          verificationActionsCount += 1;
        }
      }

      return {
        lecturerId,
        fullName: ctx.lecturerNameById.get(lecturerId) ?? "Lecturer",
        moduleCount: modIds.length,
        pendingVerificationCount,
        medianVerifyHours: median(verifyHours),
        verificationActionsCount,
      };
    })
    .sort((a, b) => b.pendingVerificationCount - a.pendingVerificationCount);
}

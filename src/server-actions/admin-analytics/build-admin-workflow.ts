import { differenceInHours, format, parseISO } from "date-fns";
import {
  ACTION_TYPE_LABELS,
  weekKeyForDate,
} from "#/server-actions/lecturer-analytics/helpers";
import {
  STATUS_FUNNEL_ORDER,
  STATUS_LABELS,
} from "#/server-actions/lecturer-analytics/constants";
import type {
  ActionMixItemDTO,
  PendingAgeBucketDTO,
  VerificationFunnelStepDTO,
  WeeklyActionCountDTO,
} from "#/server-actions/lecturer-analytics/types";
import type { AdminAnalyticsBuildContext } from "./admin-analytics-context";
import type { AdminWorkflowAnalyticsDTO } from "./types";

export function buildAdminWorkflow(
  ctx: AdminAnalyticsBuildContext,
): AdminWorkflowAnalyticsDTO {
  const pendingClaims = ctx.pipelineClaims.filter(
    (c) => c.status === "PENDING_VERIFICATION",
  );

  const pendingAges: PendingAgeBucketDTO[] = [
    { bucket: "0-1", label: "< 1 day", count: 0 },
    { bucket: "1-3", label: "1–3 days", count: 0 },
    { bucket: "3-7", label: "3–7 days", count: 0 },
    { bucket: "7+", label: "7+ days", count: 0 },
  ];

  for (const claim of pendingClaims) {
    if (!claim.submitted_at) continue;
    const hours = differenceInHours(ctx.now, parseISO(claim.submitted_at));
    if (hours < 24) pendingAges[0].count += 1;
    else if (hours < 72) pendingAges[1].count += 1;
    else if (hours < 168) pendingAges[2].count += 1;
    else pendingAges[3].count += 1;
  }

  const statusCounts = new Map<string, number>();
  for (const status of STATUS_FUNNEL_ORDER) {
    statusCounts.set(status, 0);
  }
  for (const claim of ctx.pipelineClaims) {
    statusCounts.set(
      claim.status,
      (statusCounts.get(claim.status) ?? 0) + 1,
    );
  }
  const funnel: VerificationFunnelStepDTO[] = STATUS_FUNNEL_ORDER.map(
    (status) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count: statusCounts.get(status) ?? 0,
    }),
  );

  const actionMixMap = new Map<string, number>();
  for (const action of ctx.claimActions) {
    actionMixMap.set(
      action.action_type,
      (actionMixMap.get(action.action_type) ?? 0) + 1,
    );
  }
  const actionMix: ActionMixItemDTO[] = [...actionMixMap.entries()]
    .map(([actionType, count]) => ({
      actionType,
      label: ACTION_TYPE_LABELS[actionType] ?? actionType,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const actionsByWeekMap = new Map<string, number>();
  for (const ws of ctx.weekStarts) {
    actionsByWeekMap.set(ws, 0);
  }
  for (const action of ctx.claimActions) {
    const key = action.acted_at.slice(0, 10);
    const weekKey = weekKeyForDate(key, ctx.now);
    if (weekKey && actionsByWeekMap.has(weekKey)) {
      actionsByWeekMap.set(
        weekKey,
        (actionsByWeekMap.get(weekKey) ?? 0) + 1,
      );
    }
  }
  const actionsByWeek: WeeklyActionCountDTO[] = ctx.weekStarts.map((ws) => ({
    weekStart: ws,
    weekLabel: format(parseISO(ws), "MMM d"),
    count: actionsByWeekMap.get(ws) ?? 0,
  }));

  return {
    funnel,
    pendingAges,
    actionsByWeek,
    actionMix,
    verificationActionsTotal: ctx.claimActions.length,
    stageTimings: ctx.stageTimings,
    pendingAdminApprovals: ctx.pendingAdminApprovals,
    disputeCountInPeriod: ctx.disputeCountInPeriod,
  };
}

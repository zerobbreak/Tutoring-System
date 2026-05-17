import type { User } from "@supabase/supabase-js";
import { formatRoleLabel } from "#/lib/user-role";
import type {
  AdminAnalyticsSummaryDTO,
  AdminDeadlineDTO,
  AdminLecturerActivityDTO,
  AdminPipelineDTO,
} from "#/server-actions/admin-dashboard";
import type { LecturerActivityItemDTO } from "#/server-actions/lecturer-dashboard";
import { AdminKpiCards } from "./admin-kpi-cards";
import { AdminQuickActionsPanel } from "./admin-quick-actions-panel";
import { InstitutionFeedPanel } from "./institution-feed-panel";
import { PayrollReadinessPanel } from "./payroll-readiness-panel";
import { SystemAnalyticsPanel } from "./system-analytics-panel";
import { UpcomingDeadlinesPanel } from "./upcoming-deadlines-panel";
import { WorkflowHealthPanel } from "./workflow-health-panel";

export type AdminDashboardViewProps = {
  user: User;
  booting: boolean;
  loadError: string | null;
  institutionName: string | null;
  pendingApprovalsCount: number;
  verifiedClaimsCount: number;
  activeSessionsCount: number;
  approvedHours: number;
  pipeline: AdminPipelineDTO;
  activityFeed: LecturerActivityItemDTO[];
  lecturerActivity: AdminLecturerActivityDTO[];
  deadlines: AdminDeadlineDTO[];
  analyticsSummary: AdminAnalyticsSummaryDTO;
  weekStart: string;
  weekEnd: string;
};

export function AdminDashboardView({
  user,
  booting,
  loadError,
  institutionName,
  pendingApprovalsCount,
  verifiedClaimsCount,
  activeSessionsCount,
  approvedHours,
  pipeline,
  activityFeed,
  lecturerActivity,
  deadlines,
  analyticsSummary,
  weekStart,
  weekEnd,
}: AdminDashboardViewProps) {
  const role = user.user_metadata?.role as string | undefined;
  const displayName =
    user.user_metadata?.full_name || user.email || formatRoleLabel(role);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Institution Operations Overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Welcome back,{" "}
          <span className="font-medium text-foreground">{displayName}</span>
          {institutionName ? (
            <>
              {" "}
              · <span className="font-medium text-foreground">{institutionName}</span>
            </>
          ) : null}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      <AdminKpiCards
        booting={booting}
        pendingApprovalsCount={pendingApprovalsCount}
        verifiedClaimsCount={verifiedClaimsCount}
        activeSessionsCount={activeSessionsCount}
        approvedHours={approvedHours}
        weekStart={weekStart}
        weekEnd={weekEnd}
      />

      <AdminQuickActionsPanel />

      <WorkflowHealthPanel
        booting={booting}
        pipeline={pipeline}
        lecturerActivity={lecturerActivity}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <InstitutionFeedPanel booting={booting} activityFeed={activityFeed} />
        <UpcomingDeadlinesPanel booting={booting} deadlines={deadlines} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PayrollReadinessPanel booting={booting} approvedHours={approvedHours} />
      </div>

      <SystemAnalyticsPanel booting={booting} summary={analyticsSummary} />
    </div>
  );
}

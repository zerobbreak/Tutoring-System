import { formatRoleLabel, getUserRole } from "#/lib/user-role";
import type { SessionUser } from "#/lib/root-session";
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
import { AdminTutorSessionCreationsPanel } from "#/components/admin/sessions/admin-tutor-session-creations-panel";
import type { PendingTutorSessionCreationDTO } from "#/server-actions/admin-sessions";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import { WorkflowHealthPanel } from "./workflow-health-panel";

export type AdminDashboardViewProps = {
  user: SessionUser;
  booting: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
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
  pendingTutorSessionCreations: PendingTutorSessionCreationDTO[];
  onTutorSessionApprovalsChanged?: () => void;
};

export function AdminDashboardView({
  user,
  booting,
  loadError,
  onRetryLoad,
  retryingLoad,
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
  pendingTutorSessionCreations,
  onTutorSessionApprovalsChanged,
}: AdminDashboardViewProps) {
  const role = getUserRole(user);
  const displayName =
    user.user_metadata?.full_name || user.email || formatRoleLabel(role);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain gap-4 p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 pb-10 md:p-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Institution Operations Overview
          </h2>
        </div>
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
        <QueryErrorBanner
          message={loadError}
          onRetry={onRetryLoad}
          retrying={retryingLoad}
        />
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

      <AdminTutorSessionCreationsPanel
        items={pendingTutorSessionCreations}
        loading={booting}
        showViewAllLink
        onChanged={onTutorSessionApprovalsChanged}
      />

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

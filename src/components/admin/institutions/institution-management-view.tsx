import { formatRoleLabel, getUserRole } from "#/lib/user-role";
import type { SessionUser } from "#/lib/root-session";
import type {
  AcademicTermDTO,
  CampusDTO,
  InstitutionDashboardDTO,
  InstitutionLecturerOptionDTO,
  InstitutionModuleDTO,
  InstitutionProfileDTO,
} from "#/server-actions/admin-institutions";
import { AcademicTermsPanel } from "./academic-terms-panel";
import { CampusesPanel } from "./campuses-panel";
import { ModulesPanel } from "./modules-panel";
import { InstitutionDashboardCard } from "./institution-dashboard-card";
import { InstitutionProfileCard } from "./institution-profile-card";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import { VenuesCampusHint } from "./venues-campus-hint";

export type InstitutionManagementViewProps = {
  user: SessionUser;
  booting: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  institution: InstitutionProfileDTO | null;
  campuses: CampusDTO[];
  academicTerms: AcademicTermDTO[];
  modules: InstitutionModuleDTO[];
  lecturers: InstitutionLecturerOptionDTO[];
  dashboard: InstitutionDashboardDTO | null;
  onRefresh: () => void;
};

export function InstitutionManagementView({
  user,
  booting,
  loadError,
  onRetryLoad,
  retryingLoad,
  institution,
  campuses,
  academicTerms,
  modules,
  lecturers,
  dashboard,
  onRefresh,
}: InstitutionManagementViewProps) {
  const role = getUserRole(user);
  const displayName =
    user.user_metadata?.full_name || user.email || formatRoleLabel(role);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
      <div className="shrink-0">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Institution management
        </h2>
        <p className="text-sm text-muted-foreground">
          Welcome,{" "}
          <span className="font-medium text-foreground">{displayName}</span>
          {institution ? (
            <>
              {" "}
              · managing{" "}
              <span className="font-medium text-foreground">
                {institution.name}
              </span>
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

      <InstitutionProfileCard
        institution={institution}
        booting={booting}
        onUpdated={onRefresh}
      />

      <InstitutionDashboardCard booting={booting} dashboard={dashboard} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CampusesPanel
          campuses={campuses}
          booting={booting}
          onUpdated={onRefresh}
        />
        <AcademicTermsPanel
          terms={academicTerms}
          booting={booting}
          onUpdated={onRefresh}
        />
      </div>

      <ModulesPanel
        modules={modules}
        lecturers={lecturers}
        academicTerms={academicTerms}
        booting={booting}
        onUpdated={onRefresh}
      />

      <VenuesCampusHint />
      </div>
    </div>
  );
}

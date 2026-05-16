import type { User } from "@supabase/supabase-js";
import { formatRoleLabel } from "#/lib/user-role";
import type {
  AcademicTermDTO,
  CampusDTO,
  InstitutionDashboardDTO,
  InstitutionProfileDTO,
} from "#/server-actions/admin-institutions";
import { AcademicTermsPanel } from "./academic-terms-panel";
import { CampusesPanel } from "./campuses-panel";
import { InstitutionDashboardCard } from "./institution-dashboard-card";
import { InstitutionProfileCard } from "./institution-profile-card";
import { VenuesCampusHint } from "./venues-campus-hint";

export type InstitutionManagementViewProps = {
  user: User;
  booting: boolean;
  loadError: string | null;
  institution: InstitutionProfileDTO | null;
  campuses: CampusDTO[];
  academicTerms: AcademicTermDTO[];
  dashboard: InstitutionDashboardDTO | null;
  onRefresh: () => void;
};

export function InstitutionManagementView({
  user,
  booting,
  loadError,
  institution,
  campuses,
  academicTerms,
  dashboard,
  onRefresh,
}: InstitutionManagementViewProps) {
  const role = user.user_metadata?.role as string | undefined;
  const displayName =
    user.user_metadata?.full_name || user.email || formatRoleLabel(role);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <div>
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
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </div>
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

      <VenuesCampusHint />
    </div>
  );
}

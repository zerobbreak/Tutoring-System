import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { InstitutionManagementView } from "#/components/admin/institutions/institution-management-view";
import {
  getInstitutionManagementFn,
  type AcademicTermDTO,
  type CampusDTO,
  type InstitutionDashboardDTO,
  type InstitutionProfileDTO,
} from "#/server-actions/admin-institutions";

const rootRouteApi = getRouteApi("__root__");

export const Route = createFileRoute("/admin/institutions")({
  component: AdminInstitutionsPage,
});

function AdminInstitutionsPage() {
  const { sessionData } = rootRouteApi.useLoaderData();
  const user = sessionData?.user;

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [institution, setInstitution] = useState<InstitutionProfileDTO | null>(
    null,
  );
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);
  const [academicTerms, setAcademicTerms] = useState<AcademicTermDTO[]>([]);
  const [dashboard, setDashboard] = useState<InstitutionDashboardDTO | null>(
    null,
  );

  const loadData = useCallback(async () => {
    if (!user) return;
    setBooting(true);
    setLoadError(null);
    try {
      const data = await getInstitutionManagementFn();
      setInstitution(data.institution);
      setCampuses(data.campuses);
      setAcademicTerms(data.academicTerms);
      setDashboard(data.dashboard);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load institution data",
      );
    } finally {
      setBooting(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }
    void loadData();
  }, [user, loadData]);

  if (!user) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Sign in as an administrator to manage your institution.
      </div>
    );
  }

  return (
    <InstitutionManagementView
      user={user}
      booting={booting}
      loadError={loadError}
      institution={institution}
      campuses={campuses}
      academicTerms={academicTerms}
      dashboard={dashboard}
      onRefresh={() => void loadData()}
    />
  );
}

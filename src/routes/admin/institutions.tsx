import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { InstitutionManagementView } from "#/components/admin/institutions/institution-management-view";
import { useSessionUser } from "#/lib/use-session-user";
import {
  getInstitutionManagementFn,
  type AcademicTermDTO,
  type CampusDTO,
  type InstitutionDashboardDTO,
  type InstitutionLecturerOptionDTO,
  type InstitutionModuleDTO,
  type InstitutionProfileDTO,
} from "#/server-actions/admin-institutions";

export const Route = createFileRoute("/admin/institutions")({
  component: AdminInstitutionsPage,
});

function AdminInstitutionsPage() {
  const { user, pending } = useSessionUser();

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [institution, setInstitution] = useState<InstitutionProfileDTO | null>(
    null,
  );
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);
  const [academicTerms, setAcademicTerms] = useState<AcademicTermDTO[]>([]);
  const [modules, setModules] = useState<InstitutionModuleDTO[]>([]);
  const [lecturers, setLecturers] = useState<InstitutionLecturerOptionDTO[]>(
    [],
  );
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
      setModules(data.modules);
      setLecturers(data.lecturers);
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

  if (pending || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
      modules={modules}
      lecturers={lecturers}
      dashboard={dashboard}
      onRefresh={() => void loadData()}
    />
  );
}

import type { loadAdminInstitutionContext } from "./helpers";
import type { AdminReportFiltersDTO } from "./types";

export type BuildCtx = Awaited<
  ReturnType<typeof loadAdminInstitutionContext>
> & {
  moduleIds: string[];
  lecturerModuleIds: string[];
  filters: AdminReportFiltersDTO;
  tutorId?: string;
  payrollExportId?: string;
  dateFrom: string;
  dateTo: string;
};

import type { z } from "zod";
import type { ReportFiltersDTO, ReportResultDTO } from "#/lib/report-types";
import type { PayrollExportRowDTO } from "#/server-actions/admin-payroll/types";
import type { adminReportFiltersSchema, adminReportTypeSchema } from "./schemas";

export type AdminReportCategory =
  | "payroll"
  | "claims"
  | "people"
  | "compliance"
  | "operations";

export type AdminReportType = z.infer<typeof adminReportTypeSchema>;

export type AdminReportFiltersInput = z.infer<typeof adminReportFiltersSchema>;

export type AdminReportFiltersDTO = ReportFiltersDTO & {
  payrollExportId: string | null;
  lecturerId: string | null;
};

export type AdminReportResultDTO = ReportResultDTO<AdminReportType> & {
  filters: AdminReportFiltersDTO;
};

export type AdminReportCatalogItemDTO = {
  id: AdminReportType;
  category: AdminReportCategory;
  title: string;
  description: string;
  requiresPayrollExport: boolean;
};

export type AdminModuleRow = {
  id: string;
  code: string;
  name: string;
};

export type AdminPersonOption = {
  id: string;
  fullName: string;
  email: string;
};

export type AdminReportsPageDataDTO = {
  institutionName: string | null;
  modules: AdminModuleRow[];
  tutors: AdminPersonOption[];
  lecturers: AdminPersonOption[];
  payrollExports: PayrollExportRowDTO[];
  catalog: AdminReportCatalogItemDTO[];
  defaultDateFrom: string;
  defaultDateTo: string;
};

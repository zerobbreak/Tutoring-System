import type { z } from "zod";
import type { reportFiltersSchema, reportTypeSchema } from "./schemas";

export type ReportCategory = "attendance" | "claims" | "tutor";

export type ReportType = z.infer<typeof reportTypeSchema>;

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;

export type ReportColumnDTO = {
  key: string;
  label: string;
};

export type ReportRowDTO = Record<string, string | number | null>;

export type ReportResultDTO = {
  reportType: ReportType;
  title: string;
  generatedAt: string;
  filters: ReportFiltersDTO;
  columns: ReportColumnDTO[];
  rows: ReportRowDTO[];
  summary: ReportRowDTO | null;
};

export type ReportFiltersDTO = {
  dateFrom: string;
  dateTo: string;
  moduleId: string | null;
  tutorId: string | null;
};

export type ReportCatalogItemDTO = {
  id: ReportType;
  category: ReportCategory;
  title: string;
  description: string;
};

export type LecturerReportsPageDataDTO = {
  modules: { id: string; code: string; name: string }[];
  tutors: { id: string; fullName: string; email: string }[];
  catalog: ReportCatalogItemDTO[];
  defaultDateFrom: string;
  defaultDateTo: string;
};

export type LecturerModuleRow = {
  id: string;
  code: string;
  name: string;
};

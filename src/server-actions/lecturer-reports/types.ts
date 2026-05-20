import type { z } from "zod";
import type {
  ReportColumnDTO,
  ReportFiltersDTO,
  ReportResultDTO as BaseReportResultDTO,
  ReportRowDTO,
} from "#/lib/report-types";
import type { reportFiltersSchema, reportTypeSchema } from "./schemas";

export type ReportCategory = "attendance" | "claims" | "tutor";

export type ReportType = z.infer<typeof reportTypeSchema>;

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;

export type { ReportColumnDTO, ReportFiltersDTO, ReportRowDTO };

export type LecturerReportResultDTO = BaseReportResultDTO<ReportType>;

/** Lecturer report generation result */
export type ReportResultDTO = LecturerReportResultDTO;

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

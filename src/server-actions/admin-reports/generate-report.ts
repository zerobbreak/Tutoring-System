import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildReport } from "./build-report";
import { ADMIN_REPORT_CATALOG } from "./constants";
import { loadAdminInstitutionContext, resolveModuleIds } from "./helpers";
import { adminReportFiltersSchema } from "./schemas";
import type {
  AdminReportFiltersDTO,
  AdminReportResultDTO,
  AdminReportType,
} from "./types";

function catalogTitle(reportType: AdminReportType): string {
  return ADMIN_REPORT_CATALOG.find((c) => c.id === reportType)?.title ?? reportType;
}

function toFilters(data: {
  dateFrom: string;
  dateTo: string;
  moduleId?: string;
  tutorId?: string;
  lecturerId?: string;
  payrollExportId?: string;
}): AdminReportFiltersDTO {
  return {
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    moduleId: data.moduleId ?? null,
    tutorId: data.tutorId ?? null,
    lecturerId: data.lecturerId ?? null,
    payrollExportId: data.payrollExportId ?? null,
  };
}

export const generateAdminReportFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => adminReportFiltersSchema.parse(input))
  .handler(async ({ data }): Promise<AdminReportResultDTO> => {
    const supabase = createSupabaseServerClient();
    const ctx = await loadAdminInstitutionContext(supabase);
    const filters = toFilters(data);

    if (data.dateFrom > data.dateTo) {
      throw new Error("Start date must be on or before end date.");
    }

    const moduleIds = resolveModuleIds(ctx.modules, data.moduleId);
    let lecturerModuleIds = moduleIds;
    if (data.lecturerId) {
      lecturerModuleIds = ctx.modulesWithLecturer
        .filter((m) => m.lecturerId === data.lecturerId)
        .map((m) => m.id);
      if (data.moduleId && !lecturerModuleIds.includes(data.moduleId)) {
        throw new Error("Module is not assigned to the selected lecturer.");
      }
    }

    const generatedAt = new Date().toISOString();
    const body = await buildReport(supabase, data.reportType, {
      ...ctx,
      moduleIds,
      lecturerModuleIds,
      filters,
      tutorId: data.tutorId,
      payrollExportId: data.payrollExportId,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
    });

    return {
      reportType: data.reportType,
      title: catalogTitle(data.reportType),
      generatedAt,
      filters,
      ...body,
    };
  });

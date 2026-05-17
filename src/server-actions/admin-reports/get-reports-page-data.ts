import { createServerFn } from "@tanstack/react-start";
import { format, subDays } from "date-fns";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { PayrollExportRowDTO } from "#/server-actions/admin-payroll/types";
import {
  ADMIN_REPORT_CATALOG,
  DEFAULT_REPORT_LOOKBACK_DAYS,
} from "./constants";
import { loadAdminInstitutionContext } from "./helpers";
import type { AdminPersonOption, AdminReportsPageDataDTO } from "./types";

export const getAdminReportsPageDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminReportsPageDataDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionName, modules, institutionId } =
      await loadAdminInstitutionContext(supabase);
    const now = new Date();
    const moduleIds = modules.map((m) => m.id);

    const tutors: AdminPersonOption[] = [];
    const lecturers: AdminPersonOption[] = [];

    if (moduleIds.length) {
      const { data: assignmentRows, error: assignErr } = await supabase
        .from("tutor_assignments")
        .select("tutor:users ( id, full_name, email )")
        .in("module_id", moduleIds)
        .eq("is_active", true);

      if (assignErr) throw new Error(assignErr.message);

      const tutorSeen = new Set<string>();
      for (const row of assignmentRows ?? []) {
        const tutor = Array.isArray(row.tutor) ? row.tutor[0] : row.tutor;
        if (!tutor || tutorSeen.has(tutor.id as string)) continue;
        tutorSeen.add(tutor.id as string);
        tutors.push({
          id: tutor.id as string,
          fullName: tutor.full_name as string,
          email: tutor.email as string,
        });
      }
      tutors.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    const { data: lecturerRows, error: lecErr } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("institution_id", institutionId)
      .eq("role", "LECTURER")
      .eq("is_active", true)
      .order("full_name");

    if (lecErr) throw new Error(lecErr.message);

    for (const row of lecturerRows ?? []) {
      lecturers.push({
        id: row.id as string,
        fullName: row.full_name as string,
        email: row.email as string,
      });
    }

    const { data: exportRows, error: exportErr } = await supabase
      .from("payroll_exports")
      .select(
        "id, period_label, period_start, period_end, claim_count, total_hours, status, generated_at, file_url",
      )
      .eq("institution_id", institutionId)
      .order("generated_at", { ascending: false });

    if (exportErr) throw new Error(exportErr.message);

    const payrollExports: PayrollExportRowDTO[] = (exportRows ?? []).map((row) => ({
      id: row.id as string,
      period_label: row.period_label as string,
      period_start: row.period_start as string,
      period_end: row.period_end as string,
      claim_count: row.claim_count as number,
      total_hours:
        typeof row.total_hours === "string"
          ? Number.parseFloat(row.total_hours)
          : Number(row.total_hours),
      status: row.status as string,
      generated_at: row.generated_at as string,
      file_url: (row.file_url as string | null) ?? null,
    }));

    return {
      institutionName,
      modules,
      tutors,
      lecturers,
      payrollExports,
      catalog: ADMIN_REPORT_CATALOG,
      defaultDateFrom: format(subDays(now, DEFAULT_REPORT_LOOKBACK_DAYS), "yyyy-MM-dd"),
      defaultDateTo: format(now, "yyyy-MM-dd"),
    };
  },
);

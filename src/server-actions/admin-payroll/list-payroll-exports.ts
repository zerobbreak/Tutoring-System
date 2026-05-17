import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { PayrollExportRowDTO } from "./types";

export const listPayrollExportsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ exports: PayrollExportRowDTO[] }> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: rows, error } = await supabase
      .from("payroll_exports")
      .select(
        "id, period_label, period_start, period_end, claim_count, total_hours, status, generated_at, file_url",
      )
      .eq("institution_id", institutionId)
      .order("generated_at", { ascending: false });

    if (error) throw new Error(error.message);

    const exports: PayrollExportRowDTO[] = (rows ?? []).map((row) => ({
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

    return { exports };
  },
);

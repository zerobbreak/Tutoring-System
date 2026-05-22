import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertScheduledSessionActiveForPayroll } from "#/server-actions/scheduled-sessions/session-lifecycle";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import type { PayrollExportResultDTO } from "./types";

const exportSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodLabel: z.string().min(1).max(100).optional(),
});

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const createPayrollExportFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => exportSchema.parse(input))
  .handler(async ({ data }): Promise<PayrollExportResultDTO> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    if (data.periodEnd < data.periodStart) {
      throw new Error("Period end must be on or after period start.");
    }

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id")
      .eq("institution_id", institutionId);

    if (modErr) throw new Error(modErr.message);

    const moduleIds = (modules ?? []).map((m) => m.id as string);
    if (!moduleIds.length) {
      throw new Error("No modules found for your institution.");
    }

    const { data: claims, error: claimErr } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        session_date,
        hours,
        status,
        frozen_at,
        module:modules ( code ),
        tutor:users!session_claims_tutor_id_fkey ( full_name )
      `,
      )
      .in("module_id", moduleIds)
      .eq("status", "APPROVED")
      .gte("session_date", data.periodStart)
      .lte("session_date", data.periodEnd)
      .order("session_date", { ascending: true });

    if (claimErr) throw new Error(claimErr.message);

    const claimRows = claims ?? [];
    if (!claimRows.length) {
      throw new Error(
        "No approved claims in this period. Approve claims before exporting.",
      );
    }

    const claimIds = claimRows.map((c) => c.id as string);

    const { data: alreadyExported, error: exErr } = await supabase
      .from("payroll_export_claims")
      .select("claim_id")
      .in("claim_id", claimIds);

    if (exErr) throw new Error(exErr.message);

    const exportedIds = new Set(
      (alreadyExported ?? []).map((r) => r.claim_id as string),
    );

    const toExport = claimRows.filter((c) => !exportedIds.has(c.id as string));
    if (!toExport.length) {
      throw new Error(
        "All approved claims in this period are already included in a payroll export.",
      );
    }

    for (const row of toExport) {
      await assertScheduledSessionActiveForPayroll(supabase, row.id as string);
    }

    let totalHours = 0;
    const csvLines = [
      "claim_id,tutor_name,module_code,session_date,hours,status",
    ];

    for (const row of toExport) {
      const mod = unwrapOne(
        row.module as { code: string } | { code: string }[] | null,
      );
      const tutor = unwrapOne(
        row.tutor as { full_name: string } | { full_name: string }[] | null,
      );
      const hours =
        typeof row.hours === "string"
          ? Number.parseFloat(row.hours)
          : Number(row.hours);
      const h = Number.isFinite(hours) ? hours : 0;
      totalHours += h;

      csvLines.push(
        [
          row.id,
          escapeCsv(tutor?.full_name ?? ""),
          escapeCsv(mod?.code ?? ""),
          row.session_date,
          String(h),
          row.status,
        ].join(","),
      );
    }

    const periodLabel =
      data.periodLabel?.trim() ||
      `${format(new Date(data.periodStart), "dd MMM yyyy")} – ${format(new Date(data.periodEnd), "dd MMM yyyy")}`;

    const { data: exportRow, error: insErr } = await supabase
      .from("payroll_exports")
      .insert({
        institution_id: institutionId,
        generated_by_id: userId,
        period_label: periodLabel,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        claim_count: toExport.length,
        total_hours: Math.round(totalHours * 100) / 100,
        status: "GENERATED",
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);

    const exportId = exportRow.id as string;

    const junctionRows = toExport.map((c) => ({
      export_id: exportId,
      claim_id: c.id as string,
    }));

    const { error: junctionErr } = await supabase
      .from("payroll_export_claims")
      .insert(junctionRows);

    if (junctionErr) throw new Error(junctionErr.message);

    const fileName = `payroll-export-${data.periodStart}-${data.periodEnd}.csv`;

    return {
      exportId,
      periodLabel,
      claimCount: toExport.length,
      totalHours: Math.round(totalHours * 100) / 100,
      csvContent: csvLines.join("\n"),
      fileName,
    };
  });

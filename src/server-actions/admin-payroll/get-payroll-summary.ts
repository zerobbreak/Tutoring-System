import { createServerFn } from "@tanstack/react-start";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { PayrollSummaryDTO } from "./types";

function sumHours(rows: { hours: number | string }[]): number {
  return Math.round(
    rows.reduce((s, r) => {
      const h =
        typeof r.hours === "string"
          ? Number.parseFloat(r.hours)
          : Number(r.hours);
      return s + (Number.isFinite(h) ? h : 0);
    }, 0) * 10,
  ) / 10;
}

export const getPayrollSummaryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PayrollSummaryDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id")
      .eq("institution_id", institutionId);

    if (modErr) throw new Error(modErr.message);

    const moduleIds = (modules ?? []).map((m) => m.id as string);

    if (!moduleIds.length) {
      return {
        approvedHoursAwaitingExport: 0,
        approvedClaimsAwaitingExport: 0,
        exportsThisMonth: 0,
        totalExportedHoursThisMonth: 0,
      };
    }

    const { data: approvedClaims, error: claimErr } = await supabase
      .from("session_claims")
      .select("id, hours")
      .in("module_id", moduleIds)
      .eq("status", "APPROVED");

    if (claimErr) throw new Error(claimErr.message);

    const approved = approvedClaims ?? [];
    const approvedIds = approved.map((c) => c.id as string);

    let exportedIdSet = new Set<string>();
    if (approvedIds.length) {
      const { data: exportedLinks, error: exErr } = await supabase
        .from("payroll_export_claims")
        .select("claim_id")
        .in("claim_id", approvedIds);

      if (exErr) throw new Error(exErr.message);
      exportedIdSet = new Set(
        (exportedLinks ?? []).map((r) => r.claim_id as string),
      );
    }

    const awaiting = approved.filter((c) => !exportedIdSet.has(c.id as string));

    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const { data: monthExports, error: monthErr } = await supabase
      .from("payroll_exports")
      .select("total_hours")
      .eq("institution_id", institutionId)
      .gte("period_start", monthStart)
      .lte("period_end", monthEnd);

    if (monthErr) throw new Error(monthErr.message);

    const exportRows = monthExports ?? [];

    return {
      approvedHoursAwaitingExport: sumHours(awaiting),
      approvedClaimsAwaitingExport: awaiting.length,
      exportsThisMonth: exportRows.length,
      totalExportedHoursThisMonth: Math.round(
        exportRows.reduce((s, r) => {
          const h =
            typeof r.total_hours === "string"
              ? Number.parseFloat(r.total_hours)
              : Number(r.total_hours);
          return s + (Number.isFinite(h) ? h : 0);
        }, 0) * 10,
      ) / 10,
    };
  },
);

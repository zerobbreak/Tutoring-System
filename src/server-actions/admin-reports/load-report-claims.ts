import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { ADMIN_CLAIM_REPORT_SELECT, type AdminRawClaim } from "./helpers";

export async function loadClaimsInRange(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  moduleIds: string[],
  dateFrom: string,
  dateTo: string,
  tutorId?: string,
  statuses?: string[],
): Promise<AdminRawClaim[]> {
  if (!moduleIds.length) return [];

  let query = supabase
    .from("session_claims")
    .select(ADMIN_CLAIM_REPORT_SELECT)
    .in("module_id", moduleIds)
    .gte("session_date", dateFrom)
    .lte("session_date", dateTo)
    .neq("status", "DRAFT");

  if (tutorId) query = query.eq("tutor_id", tutorId);
  if (statuses?.length) query = query.in("status", statuses);

  const { data, error } = await query.order("session_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminRawClaim[];
}

export async function loadExportClaimMap(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claimIds: string[],
): Promise<Map<string, string>> {
  if (!claimIds.length) return new Map();

  const { data, error } = await supabase
    .from("payroll_export_claims")
    .select("claim_id, export:payroll_exports ( period_label )")
    .in("claim_id", claimIds);

  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const exp = unwrapOne(
      row.export as { period_label: string } | { period_label: string }[] | null,
    );
    if (exp?.period_label) {
      map.set(row.claim_id as string, exp.period_label);
    }
  }
  return map;
}

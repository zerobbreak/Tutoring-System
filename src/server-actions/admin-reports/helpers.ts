import { requireAdminContext } from "#/lib/admin-server";
import { formatZarFromCents } from "#/lib/money";
import {
  computeClaimCompensation,
  type RateSources,
} from "#/lib/resolve-tutor-hourly-rate";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import type { AdminModuleRow } from "./types";

export async function loadAdminInstitutionContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { institutionId } = await requireAdminContext(supabase);

  const { data: institution, error: instErr } = await supabase
    .from("institutions")
    .select("id, name, default_tutor_hourly_rate_cents")
    .eq("id", institutionId)
    .single();

  if (instErr) throw new Error(instErr.message);

  const { data: modules, error: modErr } = await supabase
    .from("modules")
    .select("id, code, name, lecturer_id")
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (modErr) throw new Error(modErr.message);

  const moduleRows: (AdminModuleRow & { lecturerId: string | null })[] = (
    modules ?? []
  ).map((m) => ({
    id: m.id as string,
    code: m.code as string,
    name: m.name as string,
    lecturerId: (m.lecturer_id as string | null) ?? null,
  }));

  return {
    institutionId,
    institutionName: (institution?.name as string) ?? null,
    institutionDefaultRateCents:
      (institution?.default_tutor_hourly_rate_cents as number | null) ?? null,
    modules: moduleRows.map(({ id, code, name }) => ({ id, code, name })),
    modulesWithLecturer: moduleRows,
  };
}

export function resolveModuleIds(
  modules: AdminModuleRow[],
  moduleId?: string,
): string[] {
  if (!modules.length) return [];
  if (moduleId) {
    if (!modules.some((m) => m.id === moduleId)) {
      throw new Error("Module not found.");
    }
    return [moduleId];
  }
  return modules.map((m) => m.id);
}

export function parseHours(raw: number | string): number {
  const hours = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
  return Number.isFinite(hours) ? hours : 0;
}

export function hoursBetween(isoStart: string | null, isoEnd: string | null): number | null {
  if (!isoStart) return null;
  const start = new Date(isoStart).getTime();
  const end = isoEnd ? new Date(isoEnd).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10;
}

export function compensationForClaim(
  hours: number,
  sources: RateSources,
  frozen?: { hourly_rate_cents: number; amount_cents: number } | null,
) {
  if (frozen) {
    return {
      hourlyRateCents: frozen.hourly_rate_cents,
      amountCents: frozen.amount_cents,
      hourlyRateLabel: formatZarFromCents(frozen.hourly_rate_cents),
      amountLabel: formatZarFromCents(frozen.amount_cents),
    };
  }
  const { hourlyRateCents, amountCents } = computeClaimCompensation(hours, sources);
  return {
    hourlyRateCents,
    amountCents,
    hourlyRateLabel: formatZarFromCents(hourlyRateCents),
    amountLabel: formatZarFromCents(amountCents),
  };
}

export type AdminRawClaim = {
  id: string;
  tutor_id: string;
  module_id: string;
  session_date: string;
  hours: number | string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  frozen_at?: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  module:
    | {
        code: string;
        name: string;
        tutor_hourly_rate_cents: number | null;
        institution: { default_tutor_hourly_rate_cents: number | null } | null;
      }
    | {
        code: string;
        name: string;
        tutor_hourly_rate_cents: number | null;
        institution: { default_tutor_hourly_rate_cents: number | null } | null;
      }[]
    | null;
  tutor:
    | { id: string; full_name: string; email: string }
    | { id: string; full_name: string; email: string }[]
    | null;
  claim_compensation?:
    | { hourly_rate_cents: number; amount_cents: number }
    | { hourly_rate_cents: number; amount_cents: number }[]
    | null;
};

export function moduleRateSources(
  claim: AdminRawClaim,
  institutionDefaultRateCents: number | null,
): RateSources {
  const mod = unwrapOne(claim.module);
  const inst = mod?.institution
    ? unwrapOne(
        mod.institution as
          | { default_tutor_hourly_rate_cents: number | null }
          | { default_tutor_hourly_rate_cents: number | null }[],
      )
    : null;
  return {
    moduleRateCents: mod?.tutor_hourly_rate_cents ?? null,
    institutionDefaultRateCents:
      inst?.default_tutor_hourly_rate_cents ?? institutionDefaultRateCents,
  };
}

export const ADMIN_CLAIM_REPORT_SELECT = `
  id,
  tutor_id,
  module_id,
  session_date,
  hours,
  status,
  submitted_at,
  updated_at,
  frozen_at,
  attendance_present_count,
  attendance_expected_count,
  module:modules (
    code,
    name,
    tutor_hourly_rate_cents,
    institution:institutions ( default_tutor_hourly_rate_cents )
  ),
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email ),
  claim_compensation ( hourly_rate_cents, amount_cents )
`;

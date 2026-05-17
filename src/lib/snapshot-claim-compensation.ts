import type { SupabaseClient } from "@supabase/supabase-js";
import { computeClaimCompensation } from "#/lib/resolve-tutor-hourly-rate";

export async function snapshotClaimCompensation(
  db: SupabaseClient,
  claimId: string,
): Promise<void> {
  const { data: claim, error: claimErr } = await db
    .from("session_claims")
    .select(
      `
      id,
      hours,
      tutor_id,
      module_id,
      module:modules (
        tutor_hourly_rate_cents,
        institution_id,
        institution:institutions ( default_tutor_hourly_rate_cents )
      )
    `,
    )
    .eq("id", claimId)
    .maybeSingle();

  if (claimErr) throw new Error(claimErr.message);
  if (!claim) throw new Error("Claim not found.");

  const module = claim.module as
    | {
        tutor_hourly_rate_cents: number | null;
        institution_id: string;
        institution:
          | { default_tutor_hourly_rate_cents: number }
          | { default_tutor_hourly_rate_cents: number }[]
          | null;
      }
    | {
        tutor_hourly_rate_cents: number | null;
        institution_id: string;
        institution:
          | { default_tutor_hourly_rate_cents: number }
          | { default_tutor_hourly_rate_cents: number }[]
          | null;
      }[]
    | null;

  const mod = Array.isArray(module) ? module[0] : module;
  const institution = mod?.institution;
  const instRow = Array.isArray(institution) ? institution[0] : institution;

  const { data: assignment } = await db
    .from("tutor_assignments")
    .select("hourly_rate_cents")
    .eq("module_id", claim.module_id as string)
    .eq("tutor_id", claim.tutor_id as string)
    .eq("is_active", true)
    .maybeSingle();

  const hours =
    typeof claim.hours === "string"
      ? Number.parseFloat(claim.hours)
      : Number(claim.hours);

  const { hourlyRateCents, amountCents } = computeClaimCompensation(hours, {
    assignmentRateCents: assignment?.hourly_rate_cents as number | null,
    moduleRateCents: mod?.tutor_hourly_rate_cents ?? null,
    institutionDefaultRateCents:
      instRow?.default_tutor_hourly_rate_cents ?? null,
  });

  const { error: upsertErr } = await db.from("claim_compensation").upsert(
    {
      claim_id: claimId,
      hourly_rate_cents: hourlyRateCents,
      hours,
      amount_cents: amountCents,
      currency: "ZAR",
      calculated_at: new Date().toISOString(),
    },
    { onConflict: "claim_id" },
  );

  if (upsertErr) throw new Error(upsertErr.message);
}

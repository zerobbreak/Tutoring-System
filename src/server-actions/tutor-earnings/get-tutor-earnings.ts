import { createServerFn } from "@tanstack/react-start";
import { computeClaimCompensation } from "#/lib/resolve-tutor-hourly-rate";
import { deriveClaimPayrollStage } from "#/lib/claim-payroll-stage";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import type {
  TutorEarningsClaimRowDTO,
  TutorEarningsDTO,
  TutorPayrollBatchDTO,
} from "./types";

async function requireTutorId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

function parseHours(h: number | string): number {
  const n = typeof h === "string" ? Number.parseFloat(h) : Number(h);
  return Number.isFinite(n) ? n : 0;
}

export const getTutorEarningsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TutorEarningsDTO> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireTutorId(supabase);

    const { data: institutionRow } = await supabase
      .from("users")
      .select("institution_id, institutions ( default_tutor_hourly_rate_cents )")
      .eq("id", tutorId)
      .maybeSingle();

    const instEmbed = institutionRow?.institutions as
      | { default_tutor_hourly_rate_cents: number }
      | { default_tutor_hourly_rate_cents: number }[]
      | null;
    const institutionDefault =
      unwrapOne(instEmbed)?.default_tutor_hourly_rate_cents ?? null;

    const { data: claims, error: claimErr } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        session_date,
        hours,
        status,
        submitted_at,
        attendance_present_count,
        source_scheduled_session_id,
        module:modules ( code, name, tutor_hourly_rate_cents ),
        compensation:claim_compensation ( amount_cents, paid_at )
      `,
      )
      .eq("tutor_id", tutorId)
      .order("session_date", { ascending: false });

    if (claimErr) throw new Error(claimErr.message);

    const claimRows = claims ?? [];
    const claimIds = claimRows.map((c) => c.id as string);

    const linkedSessionIds = claimRows
      .map((c) => c.source_scheduled_session_id as string | null)
      .filter((id): id is string => Boolean(id));

    const cancelledSessionIds = new Set<string>();
    if (linkedSessionIds.length) {
      const { data: cancelledSessions, error: cancelledErr } = await supabase
        .from("scheduled_sessions")
        .select("id")
        .in("id", linkedSessionIds)
        .eq("status", "CANCELLED");
      if (cancelledErr) throw new Error(cancelledErr.message);
      for (const s of cancelledSessions ?? []) {
        cancelledSessionIds.add(s.id as string);
      }
    }

    const exportByClaimId = new Map<
      string,
      { period_label: string; status: string }
    >();

    if (claimIds.length) {
      const { data: exportLinks, error: linkErr } = await supabase
        .from("payroll_export_claims")
        .select(
          `
          claim_id,
          export:payroll_exports ( period_label, status, generated_at )
        `,
        )
        .in("claim_id", claimIds);

      if (linkErr) throw new Error(linkErr.message);

      for (const link of exportLinks ?? []) {
        const exp = unwrapOne(
          link.export as
            | { period_label: string; status: string; generated_at: string }
            | { period_label: string; status: string; generated_at: string }[]
            | null,
        );
        if (exp) {
          exportByClaimId.set(link.claim_id as string, {
            period_label: exp.period_label,
            status: exp.status,
          });
        }
      }
    }

    const claimIdsNeedingEvidence = claimRows
      .filter(
        (c) =>
          c.status !== "DRAFT" &&
          c.attendance_present_count == null &&
          c.submitted_at,
      )
      .map((c) => c.id as string);

    let evidenceClaimIds = new Set<string>();
    if (claimIdsNeedingEvidence.length) {
      const { data: evidenceRows } = await supabase
        .from("attendance_evidence")
        .select("claim_id")
        .in("claim_id", claimIdsNeedingEvidence);
      evidenceClaimIds = new Set(
        (evidenceRows ?? []).map((r) => r.claim_id as string),
      );
    }

    let totalHoursWorked = 0;
    let pendingVerificationHours = 0;
    let approvedHours = 0;
    let awaitingExportHours = 0;
    let expectedEarningsCents = 0;
    let includedInPayrollCents = 0;

    let disputedCount = 0;
    let rejectedCount = 0;
    let missingEvidenceCount = 0;

    const recentClaims: TutorEarningsClaimRowDTO[] = [];

    for (const row of claimRows) {
      const status = row.status as ClaimStatus;
      const hours = parseHours(row.hours as number | string);
      const mod = unwrapOne(
        row.module as
          | { code: string; name: string; tutor_hourly_rate_cents: number | null }
          | { code: string; name: string; tutor_hourly_rate_cents: number | null }[]
          | null,
      );
      const comp = unwrapOne(
        row.compensation as
          | { amount_cents: number; paid_at: string | null }
          | { amount_cents: number; paid_at: string | null }[]
          | null,
      );

      const exportInfo = exportByClaimId.get(row.id as string);

      if (status !== "DRAFT") totalHoursWorked += hours;
      if (status === "PENDING_VERIFICATION" || status === "VERIFIED") {
        pendingVerificationHours += hours;
      }
      if (status === "APPROVED") approvedHours += hours;

      if (status === "DISPUTED") disputedCount += 1;
      if (status === "REJECTED") rejectedCount += 1;
      if (
        status !== "DRAFT" &&
        row.attendance_present_count == null &&
        row.submitted_at &&
        !evidenceClaimIds.has(row.id as string)
      ) {
        missingEvidenceCount += 1;
      }

      let amountCents: number | null = comp?.amount_cents ?? null;
      if (amountCents == null && status === "APPROVED") {
        amountCents = computeClaimCompensation(hours, {
          moduleRateCents: mod?.tutor_hourly_rate_cents ?? null,
          institutionDefaultRateCents: institutionDefault,
        }).amountCents;
      }

      if (
        !cancelledSession &&
        status === "APPROVED" &&
        !exportInfo &&
        amountCents != null
      ) {
        awaitingExportHours += hours;
        expectedEarningsCents += amountCents;
      }
      if (!cancelledSession && exportInfo && amountCents != null) {
        includedInPayrollCents += amountCents;
      }

      const stage = deriveClaimPayrollStage({
        status,
        exportedPeriodLabel: exportInfo?.period_label ?? null,
        exportStatus: exportInfo?.status ?? null,
        paidAt: comp?.paid_at ?? null,
      });

      recentClaims.push({
        id: row.id as string,
        moduleCode: mod?.code ?? "—",
        moduleName: mod?.name ?? "",
        sessionDate: row.session_date as string,
        hours,
        status,
        payrollStageId: stage.id,
        payrollStageLabel: stage.label,
        payrollStageDetail: stage.detail,
        amountCents,
      });
    }

    const { data: batchRows, error: batchErr } = await supabase
      .from("payroll_exports")
      .select(
        `
        id,
        period_label,
        period_start,
        period_end,
        status,
        generated_at,
        claim_count,
        total_hours,
        payroll_export_claims!inner ( claim_id )
      `,
      )
      .order("generated_at", { ascending: false });

    if (batchErr) throw new Error(batchErr.message);

    const batchMap = new Map<string, TutorPayrollBatchDTO>();

    for (const batch of batchRows ?? []) {
      const links = batch.payroll_export_claims as { claim_id: string }[];
      const tutorLinks = (links ?? []).filter((l) =>
        claimIds.includes(l.claim_id),
      );
      if (!tutorLinks.length) continue;

      let batchAmount = 0;
      for (const link of tutorLinks) {
        const claim = recentClaims.find((c) => c.id === link.claim_id);
        if (claim?.amountCents) batchAmount += claim.amountCents;
      }

      batchMap.set(batch.id as string, {
        exportId: batch.id as string,
        periodLabel: batch.period_label as string,
        periodStart: batch.period_start as string,
        periodEnd: batch.period_end as string,
        status: batch.status as string,
        generatedAt: batch.generated_at as string,
        claimCount: tutorLinks.length,
        totalHours: tutorLinks.reduce((s, l) => {
          const c = recentClaims.find((r) => r.id === l.claim_id);
          return s + (c?.hours ?? 0);
        }, 0),
        totalAmountCents: batchAmount,
      });
    }

    return {
      summary: {
        totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
        pendingVerificationHours:
          Math.round(pendingVerificationHours * 10) / 10,
        approvedHours: Math.round(approvedHours * 10) / 10,
        awaitingExportHours: Math.round(awaitingExportHours * 10) / 10,
        expectedEarningsCents,
        includedInPayrollCents,
      },
      recentClaims: recentClaims.slice(0, 25),
      payrollBatches: Array.from(batchMap.values()).slice(0, 12),
      issues: {
        disputedCount,
        rejectedCount,
        missingEvidenceCount,
      },
    };
  },
);

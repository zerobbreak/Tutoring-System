import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadEvidenceByClaim } from "#/server-actions/lecturer-dashboard/load-evidence-by-claim";
import { LECTURER_SESSION_CLAIM_SELECT } from "#/server-actions/lecturer-sessions/constants";
import { mapSessionCardRow } from "#/server-actions/lecturer-sessions/map-session-card";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import { lookbackFromDate, resolveInstitutionModuleIds } from "./helpers";
import { sessionFiltersSchema } from "./schemas";
import type { AdminSessionsSummaryDTO } from "./types";

const EVIDENCE_EXPECTED_STATUSES = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "APPROVED",
] as const;

/** Lightweight summary refresh when list payload is not reloaded. */
export const getAdminSessionsSummaryFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => sessionFiltersSchema.parse(input))
  .handler(async ({ data }): Promise<AdminSessionsSummaryDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);
    const now = new Date();
    const fromDate = lookbackFromDate(data.lookbackDays);

    const moduleIds = await resolveInstitutionModuleIds(
      supabase,
      institutionId,
      data,
    );

    const empty: AdminSessionsSummaryDTO = {
      activeCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      averageAttendanceRate: null,
      openDisputesCount: 0,
      missingRegisterCount: 0,
      liveQrCount: 0,
    };

    if (!moduleIds.length) return empty;

    let claimQuery = supabase
      .from("session_claims")
      .select(LECTURER_SESSION_CLAIM_SELECT)
      .in("module_id", moduleIds)
      .gte("session_date", fromDate);

    if (data.tutorId) {
      claimQuery = claimQuery.eq("tutor_id", data.tutorId);
    }

    const { data: claimRows, error: claimErr } = await claimQuery;
    if (claimErr) throw new Error(claimErr.message);

    const rows = claimRows ?? [];
    const claimIds = rows.map((r) => r.id as string);

    const [{ evidenceClaimIds }, { scanCountByClaim }] = await Promise.all([
      loadEvidenceByClaim(supabase, claimIds),
      loadClaimCounts(supabase, claimIds),
    ]);

    const allCards = rows.map((row) =>
      mapSessionCardRow(
        row as unknown as Parameters<typeof mapSessionCardRow>[0],
        evidenceClaimIds.has(row.id as string) ? 1 : 0,
        scanCountByClaim.get(row.id as string) ?? 0,
        now,
      ),
    );

    const activeClaims = allCards.filter((c) => c.status !== "REJECTED");
    const rejectedClaims = allCards.filter((c) => c.status === "REJECTED");
    const active = activeClaims.filter(
      (c) => c.time_bucket === "today" || c.time_bucket === "upcoming",
    );
    const completed = activeClaims.filter((c) => c.time_bucket === "completed");

    const { count: cancelledScheduleCount } = await supabase
      .from("scheduled_sessions")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds)
      .eq("status", "CANCELLED");

    let rateSum = 0;
    let rateCount = 0;
    let missingRegisterCount = 0;
    let liveQrCount = 0;
    const nowIso = now.toISOString();

    for (const c of activeClaims) {
      const present = c.attendance_present_count;
      const expected = c.attendance_expected_count;
      if (
        present != null &&
        expected != null &&
        expected > 0 &&
        c.status !== "DRAFT"
      ) {
        rateSum += present / expected;
        rateCount += 1;
      }
      if (
        EVIDENCE_EXPECTED_STATUSES.includes(
          c.status as (typeof EVIDENCE_EXPECTED_STATUSES)[number],
        ) &&
        !evidenceClaimIds.has(c.id)
      ) {
        missingRegisterCount += 1;
      }
    }

    for (const row of rows) {
      const claim = row as { qr_expires_at?: string | null };
      if (claim.qr_expires_at && claim.qr_expires_at > nowIso) {
        liveQrCount += 1;
      }
    }

    const { data: instClaimIds, error: icErr } = await supabase
      .from("session_claims")
      .select("id")
      .in("module_id", moduleIds);

    if (icErr) throw new Error(icErr.message);

    const allInstClaimIds = (instClaimIds ?? []).map((r) => r.id as string);
    let openDisputesCount = 0;
    if (allInstClaimIds.length) {
      const { count, error: dispErr } = await supabase
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("status", "OPEN")
        .in("claim_id", allInstClaimIds);

      if (dispErr) throw new Error(dispErr.message);
      openDisputesCount = count ?? 0;
    }

    return {
      activeCount: active.length,
      completedCount: completed.length,
      cancelledCount: (cancelledScheduleCount ?? 0) + rejectedClaims.length,
      averageAttendanceRate:
        rateCount > 0 ? Math.round((rateSum / rateCount) * 100) / 100 : null,
      openDisputesCount,
      missingRegisterCount,
      liveQrCount,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import { LECTURER_SESSION_CLAIM_SELECT } from "#/server-actions/lecturer-sessions/constants";
import { mapSessionCardRow } from "#/server-actions/lecturer-sessions/map-session-card";
import {
  loadCancelledSchedule,
  lookbackFromDate,
  resolveInstitutionModuleIds,
} from "./helpers";
import { sessionFiltersSchema } from "./schemas";
import type { AdminSessionsPageDataDTO } from "./types";

const EVIDENCE_EXPECTED_STATUSES = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "APPROVED",
] as const;

export const listAdminSessionsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => sessionFiltersSchema.parse(input))
  .handler(async ({ data }): Promise<AdminSessionsPageDataDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);
    const now = new Date();
    const fromDate = lookbackFromDate(data.lookbackDays);

    const moduleIds = await resolveInstitutionModuleIds(
      supabase,
      institutionId,
      data,
    );

    const [modulesRes, tutorsRes, lecturersRes] = await Promise.all([
      supabase
        .from("modules")
        .select("id, code, name")
        .eq("institution_id", institutionId)
        .eq("is_active", true)
        .order("code"),
      supabase
        .from("users")
        .select("id, full_name, email")
        .eq("institution_id", institutionId)
        .eq("role", "TUTOR")
        .order("full_name"),
      supabase
        .from("users")
        .select("id, full_name, email")
        .eq("institution_id", institutionId)
        .eq("role", "LECTURER")
        .order("full_name"),
    ]);

    if (modulesRes.error) throw new Error(modulesRes.error.message);
    if (tutorsRes.error) throw new Error(tutorsRes.error.message);
    if (lecturersRes.error) throw new Error(lecturersRes.error.message);

    const emptySummary = {
      activeCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      averageAttendanceRate: null,
      openDisputesCount: 0,
      missingRegisterCount: 0,
      liveQrCount: 0,
    };

    if (!moduleIds.length) {
      return {
        summary: emptySummary,
        active: [],
        completed: [],
        cancelledSchedule: [],
        rejectedClaims: [],
        modules: (modulesRes.data ?? []).map((m) => ({
          id: m.id as string,
          code: m.code as string,
          name: m.name as string,
        })),
        tutors: (tutorsRes.data ?? []).map((t) => ({
          id: t.id as string,
          fullName: t.full_name as string,
          email: t.email as string,
        })),
        lecturers: (lecturersRes.data ?? []).map((l) => ({
          id: l.id as string,
          fullName: l.full_name as string,
          email: l.email as string,
        })),
      };
    }

    let claimQuery = supabase
      .from("session_claims")
      .select(LECTURER_SESSION_CLAIM_SELECT)
      .in("module_id", moduleIds)
      .gte("session_date", fromDate)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (data.tutorId) {
      claimQuery = claimQuery.eq("tutor_id", data.tutorId);
    }

    const { data: claimRows, error: claimErr } = await claimQuery;
    if (claimErr) throw new Error(claimErr.message);

    const rows = claimRows ?? [];
    const claimIds = rows.map((r) => r.id as string);
    const { evidenceCountByClaim, scanCountByClaim } = await loadClaimCounts(
      supabase,
      claimIds,
    );

    const allCards = rows.map((row) =>
      mapSessionCardRow(
        row as unknown as Parameters<typeof mapSessionCardRow>[0],
        evidenceCountByClaim.get(row.id as string) ?? 0,
        scanCountByClaim.get(row.id as string) ?? 0,
        now,
      ),
    );

    const activeClaims = allCards.filter((c) => c.status !== "REJECTED");
    const rejectedClaims = allCards.filter((c) => c.status === "REJECTED");
    const today = activeClaims.filter((c) => c.time_bucket === "today");
    const upcoming = activeClaims.filter((c) => c.time_bucket === "upcoming");
    const completed = activeClaims.filter((c) => c.time_bucket === "completed");
    const active = [...today, ...upcoming];

    const cancelledSchedule = await loadCancelledSchedule(supabase, moduleIds);

    const evidenceClaimIds = new Set<string>();
    for (const [id, count] of evidenceCountByClaim) {
      if (count > 0) evidenceClaimIds.add(id);
    }

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
      const expires = (row as { qr_expires_at?: string | null }).qr_expires_at;
      if (expires && expires > nowIso) {
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
      summary: {
        activeCount: active.length,
        completedCount: completed.length,
        cancelledCount: cancelledSchedule.length + rejectedClaims.length,
        averageAttendanceRate:
          rateCount > 0 ? Math.round((rateSum / rateCount) * 100) / 100 : null,
        openDisputesCount,
        missingRegisterCount,
        liveQrCount,
      },
      active,
      completed,
      cancelledSchedule,
      rejectedClaims,
      modules: (modulesRes.data ?? []).map((m) => ({
        id: m.id as string,
        code: m.code as string,
        name: m.name as string,
      })),
      tutors: (tutorsRes.data ?? []).map((t) => ({
        id: t.id as string,
        fullName: t.full_name as string,
        email: t.email as string,
      })),
      lecturers: (lecturersRes.data ?? []).map((l) => ({
        id: l.id as string,
        fullName: l.full_name as string,
        email: l.email as string,
      })),
    };
  });

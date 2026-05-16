import { createServerFn } from "@tanstack/react-start";
import { format, isAfter, parseISO, subDays } from "date-fns";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { lecturerSessionTimeBucket } from "#/lib/lecturer-session-bucket";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildAttendanceAlerts } from "#/server-actions/lecturer-dashboard/build-attendance-alerts";
import { loadEvidenceByClaim } from "#/server-actions/lecturer-dashboard/load-evidence-by-claim";
import type {
  AlertClaimRow,
  LecturerModuleDTO,
} from "#/server-actions/lecturer-dashboard/types";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { buildIntegrityIssues } from "./build-integrity-issues";
import { buildTrendSeries } from "./build-trend-series";
import {
  ALERT_LOOKBACK_DAYS,
  CLAIM_ATTENDANCE_SELECT,
  LOW_SESSION_RATIO,
  MISSING_REGISTER_LOOKBACK_DAYS,
  TREND_LOOKBACK_DAYS,
} from "./constants";
import type {
  LecturerAttendanceDashboardDTO,
  LiveAttendanceSessionDTO,
  LowAttendanceSessionDTO,
  ModuleParticipationDTO,
  PeakHourDTO,
} from "./types";

type RawClaim = {
  id: string;
  module_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  qr_expires_at: string | null;
  module:
    | { id: string; code: string; name: string }
    | { id: string; code: string; name: string }[]
    | null;
  tutor:
    | { id: string; full_name: string }
    | { id: string; full_name: string }[]
    | null;
};

function emptyDashboard(lookbackDays: number): LecturerAttendanceDashboardDTO {
  return {
    lookbackDays,
    totalPresent: 0,
    totalExpected: 0,
    averageRate: null,
    totalScans: 0,
    sessionsWithAttendance: 0,
    trendSeries: [],
    moduleParticipation: [],
    lowSessions: [],
    alerts: [],
    integrityIssues: [],
    liveSessions: [],
    peakHours: [],
  };
}

export const getAttendanceDashboardFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LecturerAttendanceDashboardDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const now = new Date();

    const trendFrom = format(subDays(now, TREND_LOOKBACK_DAYS), "yyyy-MM-dd");
    const alertFrom = format(subDays(now, ALERT_LOOKBACK_DAYS), "yyyy-MM-dd");
    const registerFrom = format(
      subDays(now, MISSING_REGISTER_LOOKBACK_DAYS),
      "yyyy-MM-dd",
    );

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("lecturer_id", lecturerId)
      .order("code", { ascending: true });

    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []) as LecturerModuleDTO[];
    const moduleIds = moduleRows.map((m) => m.id);

    if (!moduleIds.length) {
      return emptyDashboard(TREND_LOOKBACK_DAYS);
    }

    const { data: claimRows, error: claimErr } = await supabase
      .from("session_claims")
      .select(CLAIM_ATTENDANCE_SELECT)
      .in("module_id", moduleIds)
      .gte("session_date", trendFrom)
      .neq("status", "DRAFT")
      .order("session_date", { ascending: true });

    if (claimErr) throw new Error(claimErr.message);

    const claims = (claimRows ?? []) as RawClaim[];
    const claimIds = claims.map((c) => c.id);

    const [{ evidenceClaimIds }, { scanCountByClaim }] = await Promise.all([
      loadEvidenceByClaim(supabase, claimIds),
      loadClaimCounts(supabase, claimIds),
    ]);

    const unverifiedByClaim = new Map<string, number>();
    if (claimIds.length) {
      const { data: unverifiedRows, error: uvErr } = await supabase
        .from("session_attendance")
        .select("session_id")
        .in("session_id", claimIds)
        .eq("is_verified", false);

      if (uvErr) throw new Error(uvErr.message);

      for (const row of unverifiedRows ?? []) {
        const id = row.session_id as string;
        unverifiedByClaim.set(id, (unverifiedByClaim.get(id) ?? 0) + 1);
      }
    }

    let totalPresent = 0;
    let totalExpected = 0;
    let sessionsWithAttendance = 0;
    let totalScans = 0;

    const moduleAgg = new Map<
      string,
      {
        code: string;
        name: string;
        presentSum: number;
        expectedSum: number;
        sessions: number;
        scans: number;
      }
    >();

    const lowSessions: LowAttendanceSessionDTO[] = [];
    const liveSessions: LiveAttendanceSessionDTO[] = [];

    for (const row of claims) {
      const mod = unwrapOne(row.module);
      const tutor = unwrapOne(row.tutor);
      const moduleCode = mod?.code ?? "—";
      const scans = scanCountByClaim.get(row.id) ?? 0;
      totalScans += scans;

      const present = row.attendance_present_count;
      const expected = row.attendance_expected_count;

      if (present != null && expected != null && expected > 0) {
        totalPresent += present;
        totalExpected += expected;
        sessionsWithAttendance += 1;

        const rate = present / expected;
        if (rate < LOW_SESSION_RATIO) {
          lowSessions.push({
            id: row.id,
            session_date: row.session_date,
            start_time: row.start_time,
            moduleCode,
            tutorName: tutor?.full_name ?? "Tutor",
            present,
            expected,
            rate,
            scanCount: scans,
            status: row.status as LowAttendanceSessionDTO["status"],
          });
        }

        if (mod) {
          const agg = moduleAgg.get(mod.id) ?? {
            code: mod.code,
            name: mod.name,
            presentSum: 0,
            expectedSum: 0,
            sessions: 0,
            scans: 0,
          };
          agg.presentSum += present;
          agg.expectedSum += expected;
          agg.sessions += 1;
          agg.scans += scans;
          moduleAgg.set(mod.id, agg);
        }
      }

      const bucket = lecturerSessionTimeBucket(
        now,
        row.session_date,
        row.start_time,
        row.end_time,
      );

      if (bucket === "today") {
        const qrActive =
          !row.qr_expires_at ||
          !isAfter(now, parseISO(row.qr_expires_at as string));
        liveSessions.push({
          id: row.id,
          session_date: row.session_date,
          start_time: row.start_time,
          end_time: row.end_time,
          moduleCode,
          tutorName: tutor?.full_name ?? "Tutor",
          scanCount: scans,
          presentCount: present,
          expectedCount: expected,
          qrActive,
        });
      }
    }

    lowSessions.sort((a, b) => a.rate - b.rate);

    const moduleParticipation: ModuleParticipationDTO[] = [...moduleAgg.entries()]
      .map(([moduleId, agg]) => ({
        moduleId,
        moduleCode: agg.code,
        moduleName: agg.name,
        sessionCount: agg.sessions,
        averageRate:
          agg.expectedSum > 0
            ? Math.round((agg.presentSum / agg.expectedSum) * 100) / 100
            : null,
        totalScans: agg.scans,
      }))
      .sort((a, b) => (a.averageRate ?? 0) - (b.averageRate ?? 0));

    const trendSeries = buildTrendSeries(claims, TREND_LOOKBACK_DAYS, now);

    const alertClaims = claims.filter(
      (c) => c.session_date >= alertFrom,
    ) as AlertClaimRow[];

    const registerAlertClaims = alertClaims.filter(
      (c) => c.session_date >= registerFrom,
    );

    const alerts = buildAttendanceAlerts(
      moduleRows,
      registerAlertClaims,
      evidenceClaimIds,
    );

    const integrityClaims = claims.map((c) => {
      const mod = unwrapOne(c.module);
      return {
        id: c.id,
        session_date: c.session_date,
        status: c.status as ClaimStatus,
        attendance_present_count: c.attendance_present_count,
        moduleCode: mod?.code ?? "—",
      };
    });

    const integrityIssues = buildIntegrityIssues(
      integrityClaims,
      scanCountByClaim,
      evidenceClaimIds,
      unverifiedByClaim,
    );

    const peakHours = await loadPeakHours(supabase, claimIds);

    const averageRate =
      totalExpected > 0
        ? Math.round((totalPresent / totalExpected) * 100) / 100
        : null;

    return {
      lookbackDays: TREND_LOOKBACK_DAYS,
      totalPresent,
      totalExpected,
      averageRate,
      totalScans,
      sessionsWithAttendance,
      trendSeries,
      moduleParticipation,
      lowSessions: lowSessions.slice(0, 15),
      alerts,
      integrityIssues,
      liveSessions: liveSessions.sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
      ),
      peakHours,
    };
  },
);

async function loadPeakHours(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claimIds: string[],
): Promise<PeakHourDTO[]> {
  const hourCounts = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourCounts.set(h, 0);

  if (!claimIds.length) {
    return formatPeakHours(hourCounts);
  }

  const { data: scanRows, error } = await supabase
    .from("session_attendance")
    .select("check_in_time, session_id")
    .in("session_id", claimIds)
    .not("check_in_time", "is", null);

  if (error) throw new Error(error.message);

  const claimSet = new Set(claimIds);

  for (const row of scanRows ?? []) {
    if (!claimSet.has(row.session_id as string)) continue;
    const t = row.check_in_time as string;
    if (!t) continue;
    const hour = parseISO(t).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  return formatPeakHours(hourCounts);
}

function formatPeakHours(hourCounts: Map<number, number>): PeakHourDTO[] {
  return [...hourCounts.entries()]
    .map(([hour, scanCount]) => ({
      hour,
      label: formatHour(hour),
      scanCount,
    }))
    .filter((p) => p.scanCount > 0)
    .sort((a, b) => b.scanCount - a.scanCount)
    .slice(0, 8);
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

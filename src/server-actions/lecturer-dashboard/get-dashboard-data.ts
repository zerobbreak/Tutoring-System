import { createServerFn } from "@tanstack/react-start";
import { endOfWeek, format, startOfWeek, subDays } from "date-fns";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildActivityFeed } from "./build-activity-feed";
import { buildAttendanceAlerts } from "./build-attendance-alerts";
import {
  ALERT_LOOKBACK_DAYS,
  MISSING_REGISTER_LOOKBACK_DAYS,
  PENDING_CLAIMS_SELECT,
  PENDING_QUEUE_LIMIT,
  RECENT_CLAIMS_LIMIT,
  RECENT_CLAIMS_SELECT,
} from "./constants";
import { emptyDashboard } from "./empty-dashboard";
import { loadEvidenceByClaim } from "./load-evidence-by-claim";
import { mapClaimRow, mapPendingRow } from "./mappers";
import { requireLecturerId } from "./require-lecturer";
import type {
  ActivityClaimRow,
  AlertClaimRow,
  AuditRow,
  DisputeRow,
  LecturerDashboardDataDTO,
  LecturerModuleDTO,
  NotificationRow,
  RawClaimRow,
  RawPendingRow,
} from "./types";

export const getLecturerDashboardDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LecturerDashboardDataDTO> => {
    const supabase = createSupabaseServerClient();
    const uid = await requireLecturerId(supabase);

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    const alertFrom = format(subDays(now, ALERT_LOOKBACK_DAYS), "yyyy-MM-dd");
    const registerFrom = format(
      subDays(now, MISSING_REGISTER_LOOKBACK_DAYS),
      "yyyy-MM-dd",
    );

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("lecturer_id", uid)
      .order("code", { ascending: true });

    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []) as LecturerModuleDTO[];
    const moduleIds = moduleRows.map((m) => m.id);

    if (!moduleIds.length) {
      return emptyDashboard(startStr, endStr);
    }

    const [
      pendingCountRes,
      pendingListRes,
      recentRes,
      alertClaimsRes,
      activityClaimsRes,
      auditsRes,
      disputesRes,
      notificationsRes,
    ] = await Promise.all([
      supabase
        .from("session_claims")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .eq("status", "PENDING_VERIFICATION"),
      supabase
        .from("session_claims")
        .select(PENDING_CLAIMS_SELECT)
        .in("module_id", moduleIds)
        .eq("status", "PENDING_VERIFICATION")
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("session_date", { ascending: false })
        .limit(PENDING_QUEUE_LIMIT),
      supabase
        .from("session_claims")
        .select(RECENT_CLAIMS_SELECT)
        .in("module_id", moduleIds)
        .gte("session_date", startStr)
        .lte("session_date", endStr)
        .order("session_date", { ascending: false }),
      supabase
        .from("session_claims")
        .select(
          "id, module_id, session_date, status, attendance_present_count, attendance_expected_count",
        )
        .in("module_id", moduleIds)
        .gte("session_date", alertFrom)
        .neq("status", "DRAFT"),
      supabase
        .from("session_claims")
        .select(
          `
          id,
          session_date,
          status,
          submitted_at,
          updated_at,
          module:modules ( code ),
          tutor:users!session_claims_tutor_id_fkey ( full_name, email )
        `,
        )
        .in("module_id", moduleIds)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("audit_logs")
        .select("id, entity_id, event, payload, created_at")
        .eq("entity_type", "SESSION_CLAIM")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("disputes")
        .select(
          `
          id,
          claim_id,
          reason,
          raised_at,
          claim:session_claims (
            module:modules ( code ),
            tutor:users!session_claims_tutor_id_fkey ( full_name, email )
          )
        `,
        )
        .eq("status", "OPEN")
        .order("raised_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select(
          `
          id,
          type,
          subject,
          body,
          sent_at,
          claim:session_claims (
            module:modules ( code )
          )
        `,
        )
        .eq("recipient_id", uid)
        .order("sent_at", { ascending: false })
        .limit(10),
    ]);

    const errors = [
      pendingCountRes.error,
      pendingListRes.error,
      recentRes.error,
      alertClaimsRes.error,
      activityClaimsRes.error,
      auditsRes.error,
      disputesRes.error,
      notificationsRes.error,
    ].filter(Boolean);
    if (errors.length) {
      throw new Error(errors.map((e) => e!.message).join(" · "));
    }

    const pendingRows = (pendingListRes.data ?? []) as RawPendingRow[];
    const alertClaimRows = (alertClaimsRes.data ?? []) as AlertClaimRow[];
    const alertClaimIds = [
      ...new Set([
        ...pendingRows.map((r) => r.id),
        ...alertClaimRows.map((r) => r.id),
      ]),
    ];

    const { evidenceByClaim, evidenceClaimIds } = await loadEvidenceByClaim(
      supabase,
      alertClaimIds,
    );

    const registerAlertClaims = alertClaimRows.filter(
      (r) => r.session_date >= registerFrom,
    );

    const attendanceAlerts = buildAttendanceAlerts(
      moduleRows,
      registerAlertClaims,
      evidenceClaimIds,
    );

    const activityFeed = buildActivityFeed(
      (activityClaimsRes.data ?? []) as ActivityClaimRow[],
      (auditsRes.data ?? []) as AuditRow[],
      (disputesRes.data ?? []) as DisputeRow[],
      (notificationsRes.data ?? []) as NotificationRow[],
    );

    const weekClaims = (recentRes.data as RawClaimRow[]).map(mapClaimRow);

    return {
      modulesCount: moduleRows.length,
      pendingVerificationCount: pendingCountRes.count ?? 0,
      sessionsThisWeek: weekClaims.length,
      hoursThisWeek:
        Math.round(
          weekClaims.reduce((s, c) => s + Number(c.hours ?? 0), 0) * 10,
        ) / 10,
      modules: moduleRows,
      pendingClaims: pendingRows.map((r) =>
        mapPendingRow(r, evidenceByClaim),
      ),
      recentClaims: weekClaims.slice(0, RECENT_CLAIMS_LIMIT),
      attendanceAlerts,
      activityFeed,
      weekStart: startStr,
      weekEnd: endStr,
    };
  },
);

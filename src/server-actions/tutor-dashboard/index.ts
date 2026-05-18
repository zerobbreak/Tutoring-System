import { createServerFn } from "@tanstack/react-start";
import { endOfWeek, format, startOfWeek, subDays } from "date-fns";
import { TUTOR_SESSION_CHART_MAX_DAYS } from "#/components/tutor-sessions-activity-chart";
import type { SessionDayPoint } from "#/components/tutor-sessions-activity-chart";
import {
  isTutorialTimetableEvent,
  type ScheduleParsedEvent,
} from "#/lib/schedule-spreadsheet";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  mergeScheduleSources,
  parseScheduleParseResultFromJson,
  type TutorScheduleImportSource,
} from "#/lib/tutor-schedule-imports";
import { typeColumnFlagForEvent } from "#/lib/schedule-display";
import { TUTOR_VISIBLE_SESSION_CLAIMS_OR_FILTER } from "#/lib/tutor-manual-session-claim";

async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

export type DashboardClaimDTO = {
  id: string;
  session_date: string;
  start_time: string;
  hours: number;
  status: ClaimStatus;
  updated_at: string;
  topics_covered: string | null;
  coverage_validated_at: string | null;
  module: { code: string; name: string } | null;
};

export type DashboardNotificationDTO = {
  id: string;
  subject: string | null;
  body: string | null;
  is_read: boolean | null;
  sent_at: string | null;
  type: string;
};

export type TutorDashboardDataDTO = {
  activeStudentsCount: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  pendingClaimsCount: number;
  coverageGapCount: number;
  claims: DashboardClaimDTO[];
  chartSeries: SessionDayPoint[];
  pendingPreviewClaims: DashboardClaimDTO[];
  upcomingEvents: ScheduleParsedEvent[];
  notifications: DashboardNotificationDTO[];
  weekStart: string;
  weekEnd: string;
};

type RawClaimRow = Omit<DashboardClaimDTO, "module"> & {
  module: { code: string; name: string } | { code: string; name: string }[] | null;
};

function mapClaimRow(r: RawClaimRow): DashboardClaimDTO {
  const m = r.module;
  const module = m == null ? null : Array.isArray(m) ? (m[0] ?? null) : m;
  return { ...r, module };
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildDailyPointsFromClaims(
  claims: { session_date: string; hours: number | string }[],
  dayCount: number,
): SessionDayPoint[] {
  const byDay = new Map<string, { sessions: number; hours: number }>();
  for (const c of claims) {
    const key = c.session_date;
    const raw = typeof c.hours === "string" ? Number.parseFloat(c.hours) : c.hours;
    const h = Number.isFinite(raw) ? raw : 0;
    const prev = byDay.get(key) ?? { sessions: 0, hours: 0 };
    byDay.set(key, { sessions: prev.sessions + 1, hours: prev.hours + h });
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const result: SessionDayPoint[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    d.setHours(12, 0, 0, 0);
    const key = format(d, "yyyy-MM-dd");
    const agg = byDay.get(key) ?? { sessions: 0, hours: 0 };
    result.push({
      date: d.getTime(),
      dateLabel: formatDayLabel(d),
      sessions: agg.sessions,
      hoursWorked: Math.round(agg.hours * 10) / 10,
    });
  }
  return result;
}

export const getTutorDashboardDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TutorDashboardDataDTO> => {
    const supabase = createSupabaseServerClient();
    const uid = await requireUserId(supabase);

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    const chartFrom = format(
      subDays(now, TUTOR_SESSION_CHART_MAX_DAYS - 1),
      "yyyy-MM-dd",
    );

    const claimsSelect = `
        id,
        session_date,
        start_time,
        hours,
        status,
        updated_at,
        topics_covered,
        coverage_validated_at,
        module:modules ( code, name )
      `;

    const [
      rosterRes,
      claimsRes,
      pendingCountRes,
      pendingListRes,
      schedulesRes,
      notificationsRes,
    ] = await Promise.all([
      supabase
        .from("tutor_student_assignments")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", uid)
        .eq("is_active", true),
      supabase
        .from("session_claims")
        .select(claimsSelect)
        .eq("tutor_id", uid)
        .or(TUTOR_VISIBLE_SESSION_CLAIMS_OR_FILTER)
        .gte("session_date", chartFrom)
        .order("session_date", { ascending: false }),
      supabase
        .from("session_claims")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", uid)
        .or(TUTOR_VISIBLE_SESSION_CLAIMS_OR_FILTER)
        .in("status", ["DRAFT", "PENDING_VERIFICATION"]),
      supabase
        .from("session_claims")
        .select(claimsSelect)
        .eq("tutor_id", uid)
        .or(TUTOR_VISIBLE_SESSION_CLAIMS_OR_FILTER)
        .in("status", ["DRAFT", "PENDING_VERIFICATION"])
        .order("session_date", { ascending: false })
        .limit(5),
      supabase
        .from("tutor_schedule_imports")
        .select("id, file_name, parse_result")
        .eq("tutor_id", uid)
        .order("created_at", { ascending: true }),
      supabase
        .from("notifications")
        .select("id, subject, body, is_read, sent_at, type")
        .eq("recipient_id", uid)
        .order("sent_at", { ascending: false })
        .limit(5),
    ]);

    const errors = [
      rosterRes.error,
      claimsRes.error,
      pendingCountRes.error,
      pendingListRes.error,
      schedulesRes.error,
      notificationsRes.error,
    ].filter(Boolean);
    if (errors.length) {
      throw new Error(errors.map((e) => e!.message).join(" · "));
    }

    const claimRows: DashboardClaimDTO[] = (claimsRes.data as RawClaimRow[]).map(
      mapClaimRow,
    );
    const thisWeek = claimRows.filter(
      (c) => c.session_date >= startStr && c.session_date <= endStr,
    );

    let upcomingEvents: ScheduleParsedEvent[] = [];
    if (schedulesRes.data?.length) {
      const sources: TutorScheduleImportSource[] = [];
      for (const row of schedulesRes.data) {
        const parsed = parseScheduleParseResultFromJson(row.parse_result);
        if (parsed) {
          sources.push({
            id: row.id,
            fileName: row.file_name,
            result: parsed,
          });
        }
      }
      const merged = mergeScheduleSources(sources);
      const tuition = merged.events.filter((ev) =>
        isTutorialTimetableEvent(ev, typeColumnFlagForEvent(ev, merged)),
      );
      const nowMs = Date.now();
      upcomingEvents = tuition
        .filter((ev) => new Date(ev.start).getTime() >= nowMs)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 5);
    }

    return {
      activeStudentsCount: rosterRes.count ?? 0,
      sessionsThisWeek: thisWeek.length,
      hoursThisWeek:
        Math.round(
          thisWeek.reduce((s, c) => s + Number(c.hours ?? 0), 0) * 10,
        ) / 10,
      pendingClaimsCount: pendingCountRes.count ?? 0,
      coverageGapCount: claimRows.filter(
        (c) => !c.coverage_validated_at && c.status !== "DRAFT",
      ).length,
      claims: claimRows,
      chartSeries: buildDailyPointsFromClaims(
        claimRows,
        TUTOR_SESSION_CHART_MAX_DAYS,
      ),
      pendingPreviewClaims: (pendingListRes.data as RawClaimRow[]).map(
        mapClaimRow,
      ),
      upcomingEvents,
      notifications: (notificationsRes.data ??
        []) as DashboardNotificationDTO[],
      weekStart: startStr,
      weekEnd: endStr,
    };
  },
);

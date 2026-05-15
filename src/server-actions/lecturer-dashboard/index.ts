import { createServerFn } from "@tanstack/react-start";
import { endOfWeek, format, startOfWeek } from "date-fns";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { createSupabaseServerClient } from "#/lib/supabase-server";

async function requireLecturerId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const role = user.user_metadata?.role as string | undefined;
  if (role !== "LECTURER") {
    throw new Error("Lecturer access required.");
  }
  return user.id;
}

export type LecturerModuleDTO = {
  id: string;
  code: string;
  name: string;
};

export type LecturerClaimDTO = {
  id: string;
  session_date: string;
  start_time: string;
  hours: number;
  status: ClaimStatus;
  updated_at: string;
  module: { code: string; name: string } | null;
};

export type LecturerDashboardDataDTO = {
  modulesCount: number;
  pendingVerificationCount: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  modules: LecturerModuleDTO[];
  pendingClaims: LecturerClaimDTO[];
  recentClaims: LecturerClaimDTO[];
  weekStart: string;
  weekEnd: string;
};

type RawClaimRow = Omit<LecturerClaimDTO, "module"> & {
  module: { code: string; name: string } | { code: string; name: string }[] | null;
};

function mapClaimRow(r: RawClaimRow): LecturerClaimDTO {
  const m = r.module;
  const module = m == null ? null : Array.isArray(m) ? (m[0] ?? null) : m;
  return { ...r, module };
}

export const getLecturerDashboardDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LecturerDashboardDataDTO> => {
    const supabase = createSupabaseServerClient();
    const uid = await requireLecturerId(supabase);

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("lecturer_id", uid)
      .order("code", { ascending: true });

    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []) as LecturerModuleDTO[];
    const moduleIds = moduleRows.map((m) => m.id);

    if (!moduleIds.length) {
      return {
        modulesCount: 0,
        pendingVerificationCount: 0,
        sessionsThisWeek: 0,
        hoursThisWeek: 0,
        modules: [],
        pendingClaims: [],
        recentClaims: [],
        weekStart: startStr,
        weekEnd: endStr,
      };
    }

    const claimsSelect = `
        id,
        session_date,
        start_time,
        hours,
        status,
        updated_at,
        module:modules ( code, name )
      `;

    const [pendingCountRes, pendingListRes, recentRes] = await Promise.all([
      supabase
        .from("session_claims")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .eq("status", "PENDING_VERIFICATION"),
      supabase
        .from("session_claims")
        .select(claimsSelect)
        .in("module_id", moduleIds)
        .eq("status", "PENDING_VERIFICATION")
        .order("session_date", { ascending: false })
        .limit(8),
      supabase
        .from("session_claims")
        .select(claimsSelect)
        .in("module_id", moduleIds)
        .gte("session_date", startStr)
        .lte("session_date", endStr)
        .order("session_date", { ascending: false }),
    ]);

    const errors = [
      pendingCountRes.error,
      pendingListRes.error,
      recentRes.error,
    ].filter(Boolean);
    if (errors.length) {
      throw new Error(errors.map((e) => e!.message).join(" · "));
    }

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
      pendingClaims: (pendingListRes.data as RawClaimRow[]).map(mapClaimRow),
      recentClaims: weekClaims.slice(0, 8),
      weekStart: startStr,
      weekEnd: endStr,
    };
  },
);

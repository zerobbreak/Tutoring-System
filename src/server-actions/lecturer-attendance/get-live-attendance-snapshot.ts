import { createServerFn } from "@tanstack/react-start";
import { isAfter, parseISO } from "date-fns";
import { lecturerSessionTimeBucket } from "#/lib/lecturer-session-bucket";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { CLAIM_ATTENDANCE_SELECT } from "./constants";
import type { LiveAttendanceSessionDTO } from "./types";

export const getLiveAttendanceSnapshotFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<LiveAttendanceSessionDTO[]> => {
  const supabase = createSupabaseServerClient();
  const lecturerId = await requireLecturerId(supabase);
  const now = new Date();

  const { data: modules, error: modErr } = await supabase
    .from("modules")
    .select("id")
    .eq("lecturer_id", lecturerId);

  if (modErr) throw new Error(modErr.message);

  const moduleIds = (modules ?? []).map((m) => m.id as string);
  if (!moduleIds.length) return [];

  const { data: claimRows, error: claimErr } = await supabase
    .from("session_claims")
    .select(CLAIM_ATTENDANCE_SELECT)
    .in("module_id", moduleIds)
    .neq("status", "DRAFT");

  if (claimErr) throw new Error(claimErr.message);

  type RawClaim = {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    attendance_present_count: number | null;
    attendance_expected_count: number | null;
    qr_expires_at: string | null;
    module: { code: string } | { code: string }[] | null;
    tutor: { full_name: string } | { full_name: string }[] | null;
  };

  const todayClaims = ((claimRows ?? []) as RawClaim[]).filter((row) => {
    return (
      lecturerSessionTimeBucket(
        now,
        row.session_date,
        row.start_time,
        row.end_time,
      ) === "today"
    );
  });

  const claimIds = todayClaims.map((c) => c.id);
  const { scanCountByClaim } = await loadClaimCounts(supabase, claimIds);

  return todayClaims
    .map((row) => {
      const mod = unwrapOne(row.module);
      const tutor = unwrapOne(row.tutor);
      const qrActive =
        !row.qr_expires_at || !isAfter(now, parseISO(row.qr_expires_at));
      return {
        id: row.id,
        session_date: row.session_date,
        start_time: row.start_time,
        end_time: row.end_time,
        moduleCode: mod?.code ?? "—",
        tutorName: tutor?.full_name ?? "Tutor",
        scanCount: scanCountByClaim.get(row.id) ?? 0,
        presentCount: row.attendance_present_count,
        expectedCount: row.attendance_expected_count,
        qrActive,
      };
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
});

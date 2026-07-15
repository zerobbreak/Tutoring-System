import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import { loadSessionAttendanceRecords } from "#/server-actions/tutor-sessions/mappers";
import type { AttendanceRecordDTO } from "#/server-actions/tutor-sessions/types";

/** Get the detailed attendance roster for a session. */
export const getAttendanceDataFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ claimId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<AttendanceRecordDTO[]> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claim, error: cErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claim) throw new Error("Session not found.");

    return loadSessionAttendanceRecords(supabase, data.claimId);
  });

/** Get aggregate attendance trends. */
export const getHistoricalAttendanceFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data, error } = await supabase
      .from("session_claims")
      .select(`
        id,
        session_date,
        attendance_present_count,
        attendance_expected_count
      `)
      .eq("tutor_id", tutorId)
      .not("attendance_present_count", "is", null)
      .order("session_date", { ascending: true })
      .limit(10);

    if (error) throw new Error(error.message);

    return data.map((d) => ({
      date: d.session_date,
      present: d.attendance_present_count || 0,
      expected: d.attendance_expected_count || 0,
    }));
  });

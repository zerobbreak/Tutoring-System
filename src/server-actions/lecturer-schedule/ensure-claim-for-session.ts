import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";

type ScheduledSessionRow = {
  id: string;
  module_id: string;
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  venue_text: string | null;
  venue: { name: string } | null;
  series: { session_kind: string } | null;
};

/** Create or return DRAFT session_claim for a lecturer-published occurrence. */
export async function ensureClaimForScheduledSession(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  scheduledSessionId: string,
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("session_claims")
    .select("id")
    .eq("source_scheduled_session_id", scheduledSessionId)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);
  if (existing?.id) return existing.id;

  const { data: session, error: sessErr } = await supabase
    .from("scheduled_sessions")
    .select(
      `
      id,
      module_id,
      tutor_id,
      starts_at,
      ends_at,
      venue_text,
      venue:venues ( name ),
      series:schedule_series ( session_kind )
    `,
    )
    .eq("id", scheduledSessionId)
    .maybeSingle();

  if (sessErr) throw new Error(sessErr.message);
  if (!session) throw new Error("Scheduled session not found.");

  const row = session as unknown as ScheduledSessionRow;
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);
  const times = scheduleClaimTimesFromTimestamps(startsAt, endsAt);
  const venue =
    row.venue_text?.trim() ||
    row.venue?.name?.trim() ||
    null;

  const claimRow = {
    tutor_id: row.tutor_id,
    module_id: row.module_id,
    session_date: times.session_date,
    start_time: times.start_time,
    end_time: times.end_time,
    hours: times.hours,
    venue,
    status: "DRAFT" as const,
    source_scheduled_session_id: row.id,
    session_kind: row.series?.session_kind ?? "tutorial",
  };

  const { data: inserted, error: insErr } = await supabase
    .from("session_claims")
    .insert(claimRow)
    .select("id")
    .single();

  if (!insErr && inserted?.id) return inserted.id;

  if (insErr?.code === "23505") {
    const { data: again } = await supabase
      .from("session_claims")
      .select("id")
      .eq("source_scheduled_session_id", scheduledSessionId)
      .maybeSingle();
    if (again?.id) return again.id;
  }

  throw new Error(insErr?.message ?? "Could not create session claim.");
}

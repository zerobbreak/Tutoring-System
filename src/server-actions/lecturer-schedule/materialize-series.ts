import type { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  materializeWeeklyOccurrences,
  parseRecurrenceJson,
} from "#/lib/schedule-recurrence";

type SeriesRow = {
  id: string;
  module_id: string;
  tutor_id: string;
  venue_id: string | null;
  venue_text: string | null;
  dtstart: string;
  duration_minutes: number;
  recurrence_json: unknown;
};

export async function materializeSeriesSessions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  seriesId: string,
): Promise<number> {
  const { data: series, error: seriesErr } = await supabase
    .from("schedule_series")
    .select(
      "id, module_id, tutor_id, venue_id, venue_text, dtstart, duration_minutes, recurrence_json",
    )
    .eq("id", seriesId)
    .single();

  if (seriesErr) throw new Error(seriesErr.message);
  const s = series as SeriesRow;
  const recurrence = parseRecurrenceJson(s.recurrence_json);
  const dtstart = new Date(s.dtstart);
  const occurrences = materializeWeeklyOccurrences({
    dtstart,
    durationMinutes: s.duration_minutes,
    recurrence,
  });

  const { error: delErr } = await supabase
    .from("scheduled_sessions")
    .delete()
    .eq("series_id", seriesId);

  if (delErr) throw new Error(delErr.message);

  if (!occurrences.length) return 0;

  const rows = occurrences.map((o) => ({
    series_id: seriesId,
    module_id: s.module_id,
    tutor_id: s.tutor_id,
    starts_at: o.startsAt.toISOString(),
    ends_at: o.endsAt.toISOString(),
    venue_id: s.venue_id,
    venue_text: s.venue_text,
    status: "SCHEDULED" as const,
    original_starts_at: o.startsAt.toISOString(),
  }));

  const { error: insErr } = await supabase
    .from("scheduled_sessions")
    .insert(rows);

  if (insErr) throw new Error(insErr.message);
  return rows.length;
}

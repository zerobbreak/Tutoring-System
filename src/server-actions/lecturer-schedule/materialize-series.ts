import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { materializeSeriesSessionsIncremental } from "#/lib/schedule-materialize";

export async function materializeSeriesSessions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  seriesId: string,
  _actorId?: string,
): Promise<number> {
  const result = await materializeSeriesSessionsIncremental(supabase, seriesId);
  return result.totalActive;
}

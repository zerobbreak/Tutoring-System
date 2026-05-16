import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ensureClaimForScheduledSession } from "#/server-actions/lecturer-schedule/ensure-claim-for-session";
import { materializeSeriesSessions } from "#/server-actions/lecturer-schedule/materialize-series";
import { publishSeriesSchema } from "./schemas";

export const adminPublishScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publishSeriesSchema.parse(input))
  .handler(async ({ data }): Promise<{ sessionCount: number }> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: series, error: seriesErr } = await supabase
      .from("schedule_series")
      .select("id, status, module_id")
      .eq("id", data.seriesId)
      .single();

    if (seriesErr) throw new Error(seriesErr.message);

    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("institution_id")
      .eq("id", series.module_id as string)
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (modErr) throw new Error(modErr.message);
    if (!mod) throw new Error("Series not found or access denied.");

    if (series.status === "ARCHIVED") {
      throw new Error("Cannot publish an archived series.");
    }

    const sessionCount = await materializeSeriesSessions(supabase, data.seriesId);

    const { error: pubErr } = await supabase
      .from("schedule_series")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
      })
      .eq("id", data.seriesId);

    if (pubErr) throw new Error(pubErr.message);

    const { data: sessions, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("series_id", data.seriesId);

    if (sessErr) throw new Error(sessErr.message);

    for (const s of sessions ?? []) {
      await ensureClaimForScheduledSession(supabase, s.id as string);
    }

    return { sessionCount };
  });

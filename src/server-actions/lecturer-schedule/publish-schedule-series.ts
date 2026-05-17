import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ensureClaimForScheduledSession } from "./ensure-claim-for-session";
import { materializeSeriesSessions } from "./materialize-series";

const publishSchema = z.object({
  seriesId: z.string().uuid(),
});

export const publishScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publishSchema.parse(input))
  .handler(async ({ data }): Promise<{ sessionCount: number }> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const { data: series, error: seriesErr } = await supabase
      .from("schedule_series")
      .select("id, status, module_id")
      .eq("id", data.seriesId)
      .single();

    if (seriesErr) throw new Error(seriesErr.message);
    if (series.status === "ARCHIVED") {
      throw new Error("Cannot publish an archived series.");
    }

    const sessionCount = await materializeSeriesSessions(supabase, data.seriesId);

    const { data: sessions, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("series_id", data.seriesId);

    if (sessErr) throw new Error(sessErr.message);

    for (const s of sessions ?? []) {
      await ensureClaimForScheduledSession(supabase, s.id as string);
    }

    const { error: pubErr } = await supabase
      .from("schedule_series")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
      })
      .eq("id", data.seriesId);

    if (pubErr) throw new Error(pubErr.message);

    return { sessionCount };
  });

import { createServerFn } from "@tanstack/react-start";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ensureClaimForScheduledSession } from "#/server-actions/lecturer-schedule/ensure-claim-for-session";
import { materializeSeriesSessions } from "#/server-actions/lecturer-schedule/materialize-series";
import { publishSeriesSchema } from "./schemas";

async function countSeriesSessions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  seriesId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("scheduled_sessions")
    .select("id", { count: "exact", head: true })
    .eq("series_id", seriesId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const adminPublishScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publishSeriesSchema.parse(input))
  .handler(async ({ data }): Promise<{ sessionCount: number; repairedOnly: boolean }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    const { data: series, error: seriesErr } = await supabase
      .from("schedule_series")
      .select("id, status, module_id, title")
      .eq("id", data.seriesId)
      .is("deleted_at", null)
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

    const alreadyPublished = series.status === "PUBLISHED";

    const sessionCount = alreadyPublished
      ? await countSeriesSessions(supabase, data.seriesId)
      : await materializeSeriesSessions(supabase, data.seriesId, userId);

    const { data: sessions, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("series_id", data.seriesId)
      .is("deleted_at", null);

    if (sessErr) throw new Error(sessErr.message);

    for (const s of sessions ?? []) {
      await ensureClaimForScheduledSession(supabase, s.id as string);
    }

    if (!alreadyPublished) {
      const { error: pubErr } = await supabase
        .from("schedule_series")
        .update({
          status: "PUBLISHED",
          published_at: new Date().toISOString(),
        })
        .eq("id", data.seriesId);

      if (pubErr) throw new Error(pubErr.message);

      await logInstitutionAudit(supabase, {
        institutionId,
        actorId: userId,
        entityType: "SCHEDULE_SERIES",
        entityId: data.seriesId,
        event: "SCHEDULE_SERIES_PUBLISHED",
        payload: {
          title: series.title as string,
          session_count: sessionCount,
        },
      });
    }

    return { sessionCount, repairedOnly: alreadyPublished };
  });

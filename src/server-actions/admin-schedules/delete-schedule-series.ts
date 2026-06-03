import { createServerFn } from "@tanstack/react-start";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext, resolveAdminWriteClient } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { deleteDraftScheduleSeries } from "#/server-actions/lecturer-schedule/series-lifecycle";
import { assertModuleInInstitution } from "./helpers";
import { publishSeriesSchema } from "./schemas";

export const adminDeleteScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publishSeriesSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

    const { data: series, error: seriesErr } = await supabase
      .from("schedule_series")
      .select("id, status, module_id, title")
      .eq("id", data.seriesId)
      .single();

    if (seriesErr) throw new Error(seriesErr.message);
    await assertModuleInInstitution(
      supabase,
      series.module_id as string,
      institutionId,
    );

    const writeDb = resolveAdminWriteClient(supabase);
    await deleteDraftScheduleSeries(writeDb, data.seriesId, userId);

    await logInstitutionAudit(supabase, {
      institutionId,
      actorId: userId,
      entityType: "SCHEDULE_SERIES",
      entityId: data.seriesId,
      event: "SCHEDULE_SERIES_DELETED",
      payload: { title: series.title as string },
    });

    return { ok: true };
  });

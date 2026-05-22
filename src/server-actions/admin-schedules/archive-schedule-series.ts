import { createServerFn } from "@tanstack/react-start";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { archivePublishedScheduleSeries } from "#/server-actions/lecturer-schedule/series-lifecycle";
import { assertModuleInInstitution } from "./helpers";
import { publishSeriesSchema } from "./schemas";

export const adminArchiveScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publishSeriesSchema.parse(input))
  .handler(async ({ data }): Promise<{ cancelledSessionCount: number }> => {
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

    const result = await archivePublishedScheduleSeries(
      supabase,
      data.seriesId,
      userId,
    );

    await logInstitutionAudit(supabase, {
      institutionId,
      actorId: userId,
      entityType: "SCHEDULE_SERIES",
      entityId: data.seriesId,
      event: "SCHEDULE_SERIES_ARCHIVED",
      payload: {
        title: series.title as string,
        cancelled_sessions: result.cancelledSessionCount,
      },
    });

    return result;
  });

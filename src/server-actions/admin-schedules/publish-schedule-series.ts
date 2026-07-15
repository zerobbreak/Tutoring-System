import { createServerFn } from "@tanstack/react-start";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { publishScheduleSeriesCore } from "#/lib/schedule-claims";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { publishSeriesSchema } from "./schemas";

export const adminPublishScheduleSeriesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => publishSeriesSchema.parse(input))
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

    const alreadyPublished = series.status === "PUBLISHED";

    const { sessionCount, repairedOnly } = await publishScheduleSeriesCore(
      supabase,
      {
        seriesId: data.seriesId,
        materializeMode: alreadyPublished ? "repair_horizon" : "first_publish",
        actorId: userId,
      },
    );

    if (!alreadyPublished) {
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

    return { sessionCount, repairedOnly };
  });

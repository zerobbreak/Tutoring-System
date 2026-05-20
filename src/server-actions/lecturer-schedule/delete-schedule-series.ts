import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { deleteDraftScheduleSeries } from "./series-lifecycle";

const schema = z.object({
  seriesId: z.string().uuid(),
});

export const deleteScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    await deleteDraftScheduleSeries(supabase, data.seriesId, lecturerId);
    return { ok: true };
  });

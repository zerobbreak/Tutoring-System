import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { archivePublishedScheduleSeries } from "./series-lifecycle";

const schema = z.object({
  seriesId: z.string().uuid(),
});

export const archiveScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ cancelledSessionCount: number }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    return archivePublishedScheduleSeries(supabase, data.seriesId, lecturerId);
  });

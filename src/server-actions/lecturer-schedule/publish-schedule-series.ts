import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { publishScheduleSeriesCore } from "#/lib/schedule-claims";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const publishSchema = z.object({
  seriesId: z.string().uuid(),
});

export const publishScheduleSeriesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publishSchema.parse(input))
  .handler(async ({ data }): Promise<{ sessionCount: number }> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const { sessionCount } = await publishScheduleSeriesCore(supabase, {
      seriesId: data.seriesId,
      materializeMode: "first_publish",
    });

    return { sessionCount };
  });

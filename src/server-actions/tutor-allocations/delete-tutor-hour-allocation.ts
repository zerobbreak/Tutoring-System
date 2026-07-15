import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const schema = z.object({
  allocationId: z.string().uuid(),
});

export const deleteTutorHourAllocationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const { error } = await supabase
      .from("tutor_hour_allocations")
      .delete()
      .eq("id", data.allocationId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

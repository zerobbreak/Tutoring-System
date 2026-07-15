import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const schema = z.object({ allocationId: z.string().uuid() });

export const adminDeleteTutorHourAllocationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { error } = await supabase
      .from("tutor_hour_allocations")
      .delete()
      .eq("id", data.allocationId)
      .eq("institution_id", institutionId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export const deleteVenueFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const { data: row, error } = await supabase
      .from("venues")
      .update({ is_active: false })
      .eq("id", data.id)
      .eq("institution_id", institutionId)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Venue not found.");

    return { success: true as const };
  });

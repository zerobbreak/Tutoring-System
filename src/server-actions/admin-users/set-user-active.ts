import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({
  userId: z.string().uuid(),
  is_active: z.boolean(),
});

export const setUserActiveFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    if (data.userId === ctx.userId && !data.is_active) {
      throw new Error("You cannot disable your own account.");
    }

    await assertTargetUserInInstitution(supabase, ctx, data.userId);

    const admin = getSupabaseAdmin() ?? supabase;

    const { error } = await admin
      .from("users")
      .update({ is_active: data.is_active })
      .eq("id", data.userId)
      .eq("institution_id", ctx.institutionId);

    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

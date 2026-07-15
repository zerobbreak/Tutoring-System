import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({
  userId: z.string().uuid(),
  canUnlockVenues: z.boolean(),
});

export const updateUserUnlockAccessFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);
    await assertTargetUserInInstitution(supabase, ctx, data.userId);

    const admin = getSupabaseAdmin() ?? supabase;

    const { error } = await admin
      .from("users")
      .update({ can_unlock_venues: data.canUnlockVenues })
      .eq("id", data.userId)
      .eq("institution_id", ctx.institutionId);

    if (error) throw new Error(error.message);

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER",
      entityId: data.userId,
      event: "USER_UNLOCK_ACCESS_CHANGED",
      payload: { can_unlock_venues: data.canUnlockVenues },
    });

    return { ok: true as const };
  });

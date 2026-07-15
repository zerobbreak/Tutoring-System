import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ACTIVE_LIFECYCLE, SUSPENDED_LIFECYCLE } from "#/lib/user-status";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({
  userId: z.string().uuid(),
  is_active: z.boolean(),
});

export const setUserActiveFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    if (data.userId === ctx.userId && !data.is_active) {
      throw new Error("You cannot disable your own account.");
    }

    await assertTargetUserInInstitution(supabase, ctx, data.userId);

    const admin = getSupabaseAdmin() ?? supabase;

    const { data: target, error: readErr } = await admin
      .from("users")
      .select("user_status")
      .eq("id", data.userId)
      .eq("institution_id", ctx.institutionId)
      .maybeSingle();

    if (readErr) throw new Error(readErr.message);
    if (!target?.user_status) {
      throw new Error("User not found.");
    }

    if (target.user_status === "REJECTED") {
      throw new Error(
        "Rejected accounts cannot be re-enabled. The user must register again.",
      );
    }

    if (target.user_status === "PENDING_APPROVAL" && data.is_active) {
      throw new Error(
        "Approve onboarding first before enabling platform access.",
      );
    }

    const lifecycle = data.is_active ? ACTIVE_LIFECYCLE : SUSPENDED_LIFECYCLE;

    const { error } = await admin
      .from("users")
      .update(lifecycle)
      .eq("id", data.userId)
      .eq("institution_id", ctx.institutionId);

    if (error) throw new Error(error.message);

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER",
      entityId: data.userId,
      event: "USER_ACTIVE_CHANGED",
      payload: {
        is_active: data.is_active,
        user_status: lifecycle.user_status,
      },
    });

    return { ok: true as const, user_status: lifecycle.user_status };
  });

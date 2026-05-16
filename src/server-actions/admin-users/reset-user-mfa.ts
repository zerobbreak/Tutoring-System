import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({ userId: z.string().uuid() });

export const resetUserMfaFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);
    await assertTargetUserInInstitution(supabase, ctx, data.userId);

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required to reset MFA.",
      );
    }

    const { data: factorsData, error: listErr } =
      await admin.auth.admin.mfa.listFactors({ userId: data.userId });
    if (listErr) throw new Error(listErr.message);

    const factors = factorsData?.factors ?? [];
    for (const factor of factors) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: data.userId,
      });
      if (delErr) throw new Error(delErr.message);
    }

    const { error: updErr } = await admin
      .from("users")
      .update({ mfa_enabled: false })
      .eq("id", data.userId);

    if (updErr) throw new Error(updErr.message);

    await admin.from("mfa_events").insert({
      user_id: data.userId,
      event_type: "mfa_reset_by_admin",
      method: "totp",
      status: "success",
      device_info: `Reset by admin ${ctx.userId}`,
    });

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER",
      entityId: data.userId,
      event: "MFA_RESET_BY_ADMIN",
      payload: {},
    });

    return { ok: true as const };
  });

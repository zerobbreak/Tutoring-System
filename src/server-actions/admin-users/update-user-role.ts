import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { USER_ROLES, type UserRole } from "#/lib/user-role";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({
  userId: z.string().uuid(),
  role: z.enum(USER_ROLES),
});

export const updateUserRoleFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    if (data.userId === ctx.userId) {
      throw new Error("You cannot change your own role.");
    }

    const target = await assertTargetUserInInstitution(
      supabase,
      ctx,
      data.userId,
    );

    const actorRole = (
      await supabase.from("users").select("role").eq("id", ctx.userId).single()
    ).data?.role as string | undefined;

    if (data.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
      throw new Error("Only a super admin can assign the super admin role.");
    }

    if (
      target.role === "SUPER_ADMIN" &&
      actorRole !== "SUPER_ADMIN" &&
      data.role !== "SUPER_ADMIN"
    ) {
      throw new Error("Only a super admin can modify a super admin account.");
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required to update user roles.",
      );
    }

    const { error: dbErr } = await admin
      .from("users")
      .update({ role: data.role })
      .eq("id", data.userId)
      .eq("institution_id", ctx.institutionId);

    if (dbErr) throw new Error(dbErr.message);

    const { error: authErr } = await admin.auth.admin.updateUserById(
      data.userId,
      { user_metadata: { role: data.role } },
    );
    if (authErr) throw new Error(authErr.message);

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER",
      entityId: data.userId,
      event: "ROLE_CHANGED",
      payload: { from: target.role, to: data.role },
    });

    return { ok: true as const, role: data.role as UserRole };
  });

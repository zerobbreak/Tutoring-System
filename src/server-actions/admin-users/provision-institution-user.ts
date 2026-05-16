import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { provisionInstitutionUser } from "#/lib/provision-institution-user";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const INVITABLE_ROLES = ["TUTOR", "LECTURER", "ADMIN"] as const;

const schema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(255),
  role: z.enum(INVITABLE_ROLES),
  temporaryPassword: z.string().min(8).max(72).optional(),
  skipOnboarding: z.boolean().optional(),
});

export const provisionInstitutionUserFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required to provision user accounts.",
      );
    }

    const email = data.email.trim().toLowerCase();
    const approvalStatus = data.skipOnboarding
      ? ("approved" as const)
      : ("pending_documents" as const);

    const result = await provisionInstitutionUser(admin, {
      email,
      fullName: data.fullName.trim(),
      role: data.role,
      institutionId: ctx.institutionId,
      temporaryPassword: data.temporaryPassword,
      approvalStatus,
    });

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER",
      entityId: result.userId,
      event: "USER_PROVISIONED",
      payload: {
        email,
        role: data.role,
        created: result.created,
        skipOnboarding: Boolean(data.skipOnboarding),
      },
    });

    return {
      userId: result.userId,
      created: result.created,
      email,
      temporaryPassword: result.temporaryPassword,
    };
  });

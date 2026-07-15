import { createServerFn } from "@tanstack/react-start";
import { addDays } from "date-fns";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeInviteCode,
  normalizeInviteEmail,
} from "#/lib/registration-invite-code";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const INVITABLE_ROLES = ["TUTOR", "LECTURER", "ADMIN"] as const;

const schema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(255).optional(),
  role: z.enum(INVITABLE_ROLES),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export const createRegistrationInviteFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required to create registration invites.",
      );
    }

    const email = normalizeInviteEmail(data.email);
    const expiresInDays = data.expiresInDays ?? 7;
    const expiresAt = addDays(new Date(), expiresInDays).toISOString();

    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser?.id) {
      throw new Error(
        "This email already has an account. Use “Provision now” or ask them to sign in.",
      );
    }

    const now = new Date().toISOString();

    const { error: revokeErr } = await admin
      .from("user_registration_invites")
      .update({ revoked_at: now })
      .eq("institution_id", ctx.institutionId)
      .eq("email", email)
      .is("used_at", null)
      .is("revoked_at", null);

    if (revokeErr) throw new Error(revokeErr.message);

    const code = generateInviteCode();
    const codeHash = hashInviteCode(normalizeInviteCode(code));

    const { data: inserted, error: insertErr } = await admin
      .from("user_registration_invites")
      .insert({
        institution_id: ctx.institutionId,
        email,
        full_name: data.fullName?.trim() || null,
        role: data.role,
        code_hash: codeHash,
        created_by: ctx.userId,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(insertErr.message);

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER_REGISTRATION_INVITE",
      entityId: inserted.id as string,
      event: "INVITE_CREATED",
      payload: { email, role: data.role, expiresAt },
    });

    return {
      inviteId: inserted.id as string,
      code,
      expiresAt,
      email,
      role: data.role,
    };
  });

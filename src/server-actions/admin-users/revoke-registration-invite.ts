import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const schema = z.object({
  inviteId: z.string().uuid(),
});

export const revokeRegistrationInviteFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required to revoke registration invites.",
      );
    }

    const { data: invite, error: fetchErr } = await admin
      .from("user_registration_invites")
      .select("id, email, used_at, revoked_at")
      .eq("id", data.inviteId)
      .eq("institution_id", ctx.institutionId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!invite) throw new Error("Invite not found.");

    if (invite.used_at) {
      throw new Error("This invite has already been used.");
    }
    if (invite.revoked_at) {
      return { ok: true as const };
    }

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("user_registration_invites")
      .update({ revoked_at: now })
      .eq("id", data.inviteId);

    if (updErr) throw new Error(updErr.message);

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER_REGISTRATION_INVITE",
      entityId: data.inviteId,
      event: "INVITE_REVOKED",
      payload: { email: invite.email },
    });

    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  ACTIVE_LIFECYCLE,
  REJECTED_LIFECYCLE,
  type UserStatus,
} from "#/lib/user-status";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({
  userId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(2000).optional(),
});

export const reviewOnboardingFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);
    await assertTargetUserInInstitution(supabase, ctx, data.userId);

    const now = new Date().toISOString();
    const lifecycle =
      data.decision === "approve" ? ACTIVE_LIFECYCLE : REJECTED_LIFECYCLE;
    const user_status = lifecycle.user_status as UserStatus;

    const admin = getSupabaseAdmin() ?? supabase;

    const { error: userErr } = await admin
      .from("users")
      .update({
        ...lifecycle,
        approval_reviewed_at: now,
        approval_reviewed_by: ctx.userId,
        approval_note: data.note?.trim() || null,
      })
      .eq("id", data.userId)
      .eq("institution_id", ctx.institutionId);

    if (userErr) throw new Error(userErr.message);

    await admin
      .from("user_onboarding_documents")
      .update({
        reviewed_at: now,
        reviewed_by: ctx.userId,
      })
      .eq("user_id", data.userId);

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "USER",
      entityId: data.userId,
      event: "USER_ONBOARDING_REVIEWED",
      payload: {
        decision: data.decision,
        note: data.note ?? null,
        user_status,
      },
    });

    return { ok: true as const, user_status };
  });

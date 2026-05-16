import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({
  userId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(2000).optional(),
});

export const reviewOnboardingFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);
    await assertTargetUserInInstitution(supabase, ctx, data.userId);

    const now = new Date().toISOString();
    const approval_status =
      data.decision === "approve" ? "approved" : "rejected";

    const admin = getSupabaseAdmin() ?? supabase;

    const { error: userErr } = await admin
      .from("users")
      .update({
        approval_status,
        approval_reviewed_at: now,
        approval_reviewed_by: ctx.userId,
        approval_note: data.note?.trim() || null,
        is_active: data.decision === "approve",
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
      payload: { decision: data.decision, note: data.note ?? null },
    });

    return { ok: true as const, approval_status };
  });

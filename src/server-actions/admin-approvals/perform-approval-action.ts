import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { executeClaimTransition } from "#/lib/claim-workflow/execute-transition";
import { createStepUpMfaLogger } from "#/lib/claim-workflow/log-step-up-mfa";
import { requireAdminContext } from "#/lib/admin-server";
import { snapshotClaimCompensation } from "#/lib/snapshot-claim-compensation";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { AdminApprovalActionKind } from "./types";

const actionSchema = z.object({
  claimId: z.string().uuid(),
  action: z.enum([
    "APPROVE",
    "REJECT",
    "REQUEST_CLARIFICATION",
    "ESCALATE",
    "FREEZE",
  ]),
  comment: z.string().max(2000).optional(),
  stepUpCode: z.string().min(6).max(12),
});

export const performAdminApprovalActionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { userId, role } = await requireAdminContext(supabase);

    const result = await executeClaimTransition(supabase, {
      claimId: data.claimId,
      action: data.action as AdminApprovalActionKind,
      actor: { userId, role },
      comment: data.comment,
      stepUpCode: data.stepUpCode,
      logStepUpMfa: createStepUpMfaLogger(supabase, userId),
    });

    if (data.action === "APPROVE") {
      const { assertScheduledSessionActiveForPayroll } = await import(
        "#/server-actions/scheduled-sessions/session-lifecycle"
      );
      await assertScheduledSessionActiveForPayroll(supabase, data.claimId);
      const admin = getSupabaseAdmin();
      if (admin) {
        await assertScheduledSessionActiveForPayroll(admin, data.claimId);
        await snapshotClaimCompensation(admin, data.claimId);
      } else {
        await snapshotClaimCompensation(supabase, data.claimId);
      }
    }

    return {
      ok: true as const,
      status: result.status,
      frozen: result.frozen,
    };
  });

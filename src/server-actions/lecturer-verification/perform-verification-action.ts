import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { executeClaimTransition } from "#/lib/claim-workflow/execute-transition";
import { createStepUpMfaLogger } from "#/lib/claim-workflow/log-step-up-mfa";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import type { VerificationActionKind } from "./types";

const actionSchema = z.object({
  claimId: z.string().uuid(),
  action: z.enum([
    "APPROVE",
    "REJECT",
    "DISPUTE",
    "REQUEST_CLARIFICATION",
  ]),
  comment: z.string().max(2000).optional(),
  stepUpCode: z.string().min(6).max(12),
});

export const performVerificationActionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const result = await executeClaimTransition(supabase, {
      claimId: data.claimId,
      action: data.action as VerificationActionKind,
      actor: { userId: lecturerId, role: "LECTURER" },
      comment: data.comment,
      stepUpCode: data.stepUpCode,
      logStepUpMfa: createStepUpMfaLogger(supabase, lecturerId),
    });

    return {
      ok: true as const,
      status: result.status,
    };
  });

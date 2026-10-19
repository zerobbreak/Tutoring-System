import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { requireStepUpMfa } from "#/lib/mfa-auth-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { submitClaimForVerification } from "#/server-actions/tutor-sessions/claim-submission";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

const submitClaimSchema = z.object({
  claimId: z.string().uuid(),
  noShowReason: z.string().max(2000).optional(),
  stepUpCode: z.string().optional(),
});

/** Submit a draft claim for verification (tutor attests with step-up MFA). */
export const submitSessionClaimFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { escalated } = await submitClaimForVerification(supabase, {
      claimId: data.claimId,
      tutorId,
      mode: {
        kind: "tutor",
        noShowReason: data.noShowReason,
        attest: () =>
          requireStepUpMfa(supabase, data.stepUpCode, "submit this session"),
      },
    });

    return { ok: true as const, escalated };
  });

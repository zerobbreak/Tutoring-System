import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

const generateQRSchema = z.object({
  claimId: z.string().uuid(),
  expiresInMinutes: z.number().int().min(1).max(1440).default(30),
});

/** Generate/refresh a secure QR token for a session. */
export const generateSessionTokenFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => generateQRSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + data.expiresInMinutes);

    const qr_token = crypto.randomUUID();

    const { error } = await supabase
      .from("session_claims")
      .update({
        qr_token,
        qr_expires_at: expiresAt.toISOString(),
      })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (error) throw new Error(error.message);
    return { qr_token, qr_expires_at: expiresAt.toISOString() };
  });

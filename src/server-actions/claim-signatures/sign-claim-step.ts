import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimContentHash,
  SIGNED_CLAIM_COLUMNS,
  type SignedClaimContent,
} from "#/lib/claim-signatures/content-hash";

export type SignerRole = "TUTOR" | "LECTURER" | "ADMIN";

export const MISSING_SIGNATURE_MESSAGE =
  "Add your signature under Settings → Security before signing claims.";

/** The signer's saved signature image; throws a user-safe error when none is saved. */
export async function loadSignerSignature(
  db: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await db
    .from("user_signatures")
    .select("image_data_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const image = data?.image_data_url as string | undefined;
  if (!image) throw new Error(MISSING_SIGNATURE_MESSAGE);
  return image;
}

/** Hash of the claim's current content (same rules used when it was signed). */
export async function currentClaimContentHash(
  db: SupabaseClient,
  claimId: string,
): Promise<string> {
  const [claimRes, evRes] = await Promise.all([
    db.from("session_claims").select(SIGNED_CLAIM_COLUMNS).eq("id", claimId).maybeSingle(),
    db.from("attendance_evidence").select("id").eq("claim_id", claimId),
  ]);
  if (claimRes.error) throw new Error(claimRes.error.message);
  if (evRes.error) throw new Error(evRes.error.message);
  if (!claimRes.data) throw new Error("Claim not found.");
  const evidenceIds = ((evRes.data ?? []) as { id: string }[]).map((r) => r.id);
  return await claimContentHash(
    claimRes.data as unknown as SignedClaimContent,
    evidenceIds,
  );
}

/**
 * Record an immutable signature for one claim step. Call after the step's
 * status change and authenticator check have succeeded.
 */
export async function recordClaimSignature(
  db: SupabaseClient,
  input: {
    claimId: string;
    signerId: string;
    signerRole: SignerRole;
    actionType: string;
    imageDataUrl: string;
  },
): Promise<void> {
  const contentHash = await currentClaimContentHash(db, input.claimId);
  const { error } = await db.from("claim_signatures").insert({
    claim_id: input.claimId,
    signer_id: input.signerId,
    signer_role: input.signerRole,
    action_type: input.actionType,
    image_data_url: input.imageDataUrl,
    content_hash: contentHash,
  });
  if (error) throw new Error(error.message);
}

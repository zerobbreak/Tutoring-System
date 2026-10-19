import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { normalizeSupabaseNestedRow } from "#/lib/supabase-nested-row";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/settings/require-user";
import { currentClaimContentHash } from "./sign-claim-step";

export type ClaimSignatureDTO = {
  id: string;
  signerName: string;
  signerRole: "TUTOR" | "LECTURER" | "ADMIN";
  actionType: string;
  imageDataUrl: string;
  signedAt: string;
  contentHash: string;
  /** True when the claim's content still matches what was signed. */
  matchesCurrent: boolean;
};

const schema = z.object({ claimId: z.string().uuid() });

/** Signatures on a claim, oldest first. RLS limits this to people who can see the claim. */
export const listClaimSignaturesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<ClaimSignatureDTO[]> => {
    const supabase = createSupabaseServerClient();
    await requireUserId(supabase);

    const { data: rows, error } = await supabase
      .from("claim_signatures")
      .select(
        "id, signer_role, action_type, image_data_url, content_hash, signed_at, signer:users!claim_signatures_signer_id_fkey ( full_name )",
      )
      .eq("claim_id", data.claimId)
      .order("signed_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];

    const current = await currentClaimContentHash(supabase, data.claimId);

    return rows.map((r) => {
      const signer = normalizeSupabaseNestedRow(
        r.signer as { full_name: string } | { full_name: string }[] | null,
      );
      return {
        id: r.id as string,
        signerName: signer?.full_name ?? "Unknown user",
        signerRole: r.signer_role as ClaimSignatureDTO["signerRole"],
        actionType: r.action_type as string,
        imageDataUrl: r.image_data_url as string,
        signedAt: r.signed_at as string,
        contentHash: r.content_hash as string,
        matchesCurrent: r.content_hash === current,
      };
    });
  });

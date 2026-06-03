import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { softDeleteClaim } from "#/lib/soft-delete";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { DELETE_DRAFT_CLAIMS_BATCH } from "#/server-actions/tutor-sessions/constants";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

const deleteDraftClaimSchema = z.object({
  claimId: z.string().uuid(),
});

const deleteDraftClaimsSchema = z.object({
  claimIds: z.array(z.string().uuid()).min(1).max(1000),
});

/** Discard a draft claim (tutor-owned only). */
export const deleteDraftSessionClaimFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteDraftClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select("id, status")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .is("deleted_at", null)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (row.status !== "DRAFT") {
      throw new Error("Only draft sessions can be discarded.");
    }

    await softDeleteClaim(
      supabase,
      data.claimId,
      tutorId,
      "Tutor discarded draft",
    );
    return { ok: true as const };
  });

/** Discard multiple draft claims (tutor-owned only). */
export const deleteDraftSessionClaimsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteDraftClaimsSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);
    const uniqueIds = [...new Set(data.claimIds)];

    const rows: { id: string; status: string }[] = [];
    for (let i = 0; i < uniqueIds.length; i += DELETE_DRAFT_CLAIMS_BATCH) {
      const batch = uniqueIds.slice(i, i + DELETE_DRAFT_CLAIMS_BATCH);
      const { data: batchRows, error: selErr } = await supabase
        .from("session_claims")
        .select("id, status")
        .eq("tutor_id", tutorId)
        .is("deleted_at", null)
        .in("id", batch);

      if (selErr) throw new Error(selErr.message);
      rows.push(...(batchRows ?? []));
    }

    const drafts = rows.filter((r) => r.status === "DRAFT");
    if (drafts.length !== uniqueIds.length) {
      throw new Error(
        "Only draft sessions can be discarded, and each must belong to you.",
      );
    }

    for (let i = 0; i < uniqueIds.length; i += DELETE_DRAFT_CLAIMS_BATCH) {
      const batch = uniqueIds.slice(i, i + DELETE_DRAFT_CLAIMS_BATCH);
      for (const claimId of batch) {
        await softDeleteClaim(
          supabase,
          claimId,
          tutorId,
          "Tutor discarded draft",
        );
      }
    }

    return { ok: true as const, deletedCount: uniqueIds.length };
  });

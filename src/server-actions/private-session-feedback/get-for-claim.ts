import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { mapFeedbackRow } from "#/server-actions/private-session-feedback/map-row";
import type { PrivateSessionFeedbackDTO } from "#/server-actions/private-session-feedback/types";

const claimIdSchema = z.object({ claimId: z.string().uuid() });

export const getPrivateSessionFeedbackForClaimFn = createServerFn({
  method: "GET",
})
  .validator((input: unknown) => claimIdSchema.parse(input))
  .handler(async ({ data }): Promise<PrivateSessionFeedbackDTO | null> => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: row, error } = await supabase
      .from("private_session_feedback")
      .select(
        `
        id,
        claim_id,
        tutor_id,
        author_id,
        category_ratings,
        note,
        created_at,
        updated_at,
        author:users ( full_name )
      `,
      )
      .eq("claim_id", data.claimId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    return mapFeedbackRow(row);
  });

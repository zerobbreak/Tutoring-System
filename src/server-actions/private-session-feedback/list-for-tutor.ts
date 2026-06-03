import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { mapFeedbackRow } from "#/server-actions/private-session-feedback/map-row";
import type { TutorPrivateFeedbackListItemDTO } from "#/server-actions/private-session-feedback/types";

const listSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export const listPrivateSessionFeedbackForTutorFn = createServerFn({
  method: "GET",
})
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<TutorPrivateFeedbackListItemDTO[]> => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const limit = data.limit ?? 20;

    const { data: rows, error } = await supabase
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
        author:users ( full_name ),
        claim:session_claims (
          session_date,
          module:modules ( code, name )
        )
      `,
      )
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const base = mapFeedbackRow(r);
      const claimRaw = r.claim;
      const claim = Array.isArray(claimRaw) ? claimRaw[0] : claimRaw;
      const modRaw = claim?.module;
      const mod = Array.isArray(modRaw) ? modRaw[0] : modRaw;
      return {
        ...base,
        moduleCode: (mod as { code: string } | null)?.code ?? "—",
        moduleName: (mod as { name: string } | null)?.name ?? "",
        sessionDate: (claim as { session_date: string } | null)?.session_date ?? "",
      };
    });
  });

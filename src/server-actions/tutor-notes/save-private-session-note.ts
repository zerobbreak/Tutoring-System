import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import { SESSION_NOTE_MAX_LENGTH } from "#/server-actions/tutor-notes/update-session-notes";

const schema = z.object({
  claimId: z.string().uuid(),
  body: z.string().max(SESSION_NOTE_MAX_LENGTH),
});

/** Tutor-only note; editable at any claim status. */
export const savePrivateSessionNoteFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const uid = await requireUserId(supabase);

    const { error } = await supabase.from("tutor_private_session_notes").upsert(
      { claim_id: data.claimId, tutor_id: uid, body: data.body.trim() },
      { onConflict: "claim_id" },
    );

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

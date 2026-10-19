import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { TUTOR_EDITABLE_STATUSES } from "#/lib/claim-workflow/transitions";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import {
  mapNotesClaimRow,
  NOTES_CLAIM_SELECT,
  type RawNotesClaimRow,
} from "#/server-actions/tutor-notes/mappers";
import type { SessionNotesDTO } from "#/server-actions/tutor-notes/types";

const schema = z.object({ claimId: z.string().uuid() });

/**
 * One session's notes for the Notes tab, plus the tutor's previous session in
 * the same module (struggles / review) so they can follow up.
 */
export const getSessionNotesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<SessionNotesDTO> => {
    const supabase = createSupabaseServerClient();
    const uid = await requireUserId(supabase);

    const { data: row, error } = await supabase
      .from("session_claims")
      .select(`${NOTES_CLAIM_SELECT}, frozen_at`)
      .eq("id", data.claimId)
      .eq("tutor_id", uid)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Session not found.");
    const claim = row as unknown as RawNotesClaimRow & {
      frozen_at: string | null;
    };

    const [privRes, ackRes, prevRes] = await Promise.all([
      supabase
        .from("tutor_private_session_notes")
        .select("body")
        .eq("claim_id", claim.id)
        .maybeSingle(),
      supabase
        .from("session_note_acknowledgements")
        .select("seen_at")
        .eq("claim_id", claim.id)
        .maybeSingle(),
      supabase
        .from("session_claims")
        .select("id, session_date, student_struggles, revision_topics")
        .eq("tutor_id", uid)
        .eq("module_id", claim.module_id)
        .is("deleted_at", null)
        .lt("session_date", claim.session_date)
        .or("student_struggles.not.is.null,revision_topics.not.is.null")
        .order("session_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (privRes.error) throw new Error(privRes.error.message);
    if (ackRes.error) throw new Error(ackRes.error.message);
    if (prevRes.error) throw new Error(prevRes.error.message);

    const prev = prevRes.data;
    return {
      ...mapNotesClaimRow(claim, {
        privateNote: (privRes.data?.body as string | undefined) ?? null,
        seenAt: (ackRes.data?.seen_at as string | undefined) ?? null,
      }),
      shared_editable:
        claim.frozen_at == null &&
        TUTOR_EDITABLE_STATUSES.includes(claim.status),
      previous: prev
        ? {
            claim_id: prev.id as string,
            session_date: prev.session_date as string,
            student_struggles: prev.student_struggles as string | null,
            revision_topics: prev.revision_topics as string | null,
          }
        : null,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { isTutorSessionClaimListed } from "#/lib/tutor-manual-session-claim";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import {
  mapNotesClaimRow,
  NOTES_CLAIM_SELECT,
  type RawNotesClaimRow,
} from "#/server-actions/tutor-notes/mappers";
import type { TutorNotesClaimDTO } from "#/server-actions/tutor-notes/types";

/** Notes history for the signed-in tutor, newest session first. */
export const listTutorNotesClaimsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TutorNotesClaimDTO[]> => {
    const supabase = createSupabaseServerClient();
    const uid = await requireUserId(supabase);

    const { data, error } = await supabase
      .from("session_claims")
      .select(NOTES_CLAIM_SELECT)
      .eq("tutor_id", uid)
      .is("deleted_at", null)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as RawNotesClaimRow[]).filter(
      isTutorSessionClaimListed,
    );
    const ids = rows.map((r) => r.id);

    const privateMap = new Map<string, string>();
    const seenMap = new Map<string, string>();
    if (ids.length) {
      const [privRes, ackRes] = await Promise.all([
        supabase
          .from("tutor_private_session_notes")
          .select("claim_id, body")
          .in("claim_id", ids),
        supabase
          .from("session_note_acknowledgements")
          .select("claim_id, seen_at")
          .in("claim_id", ids),
      ]);
      if (privRes.error) throw new Error(privRes.error.message);
      if (ackRes.error) throw new Error(ackRes.error.message);
      for (const p of privRes.data ?? []) {
        if ((p.body as string).trim()) {
          privateMap.set(p.claim_id as string, p.body as string);
        }
      }
      for (const a of ackRes.data ?? []) {
        seenMap.set(a.claim_id as string, a.seen_at as string);
      }
    }

    return rows.map((r) =>
      mapNotesClaimRow(r, {
        privateNote: privateMap.get(r.id) ?? null,
        seenAt: seenMap.get(r.id) ?? null,
      }),
    );
  },
);

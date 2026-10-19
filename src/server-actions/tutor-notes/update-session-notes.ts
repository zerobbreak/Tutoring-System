import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { assertTutorCanEditClaim } from "#/lib/claim-workflow/guards";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

export const SESSION_NOTE_MAX_LENGTH = 4000;

const sharedNotesSchema = z.object({
  claimId: z.string().uuid(),
  topicsCovered: z.string().max(SESSION_NOTE_MAX_LENGTH),
  studentStruggles: z.string().max(SESSION_NOTE_MAX_LENGTH),
  revisionTopics: z.string().max(SESSION_NOTE_MAX_LENGTH),
});

const trimOrNull = (s: string) => (s.trim() === "" ? null : s.trim());

/** Save the shared (lecturer-visible) notes. Locked once the claim is submitted. */
export const updateSessionNotesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => sharedNotesSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const uid = await requireUserId(supabase);

    const { data: existing, error: loadErr } = await supabase
      .from("session_claims")
      .select("status, frozen_at")
      .eq("id", data.claimId)
      .eq("tutor_id", uid)
      .is("deleted_at", null)
      .maybeSingle();

    if (loadErr) throw new Error(loadErr.message);
    if (!existing) throw new Error("Session not found.");
    assertTutorCanEditClaim(
      existing.status as ClaimStatus,
      existing.frozen_at as string | null,
      "edit notes for this session",
    );

    const { error } = await supabase
      .from("session_claims")
      .update({
        topics_covered: trimOrNull(data.topicsCovered),
        student_struggles: trimOrNull(data.studentStruggles),
        revision_topics: trimOrNull(data.revisionTopics),
      })
      .eq("id", data.claimId)
      .eq("tutor_id", uid);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

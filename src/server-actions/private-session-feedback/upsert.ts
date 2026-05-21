import { createServerFn } from "@tanstack/react-start";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireLecturerId } from "#/lib/lecturer-server";
import {
  assertClaimEligibleForPrivateFeedback,
  hasFeedbackContent,
  normalizeCategoryRatings,
  upsertPrivateFeedbackInputSchema,
} from "#/lib/private-session-feedback";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { mapFeedbackRow } from "#/server-actions/private-session-feedback/map-row";
import type { PrivateSessionFeedbackDTO } from "#/server-actions/private-session-feedback/types";

export const upsertPrivateSessionFeedbackFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    upsertPrivateFeedbackInputSchema.parse(input),
  )
  .handler(async ({ data }): Promise<PrivateSessionFeedbackDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: claim, error: claimErr } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        status,
        tutor_id,
        module:modules ( institution_id, lecturer_id, code )
      `,
      )
      .eq("id", data.claimId)
      .is("deleted_at", null)
      .maybeSingle();

    if (claimErr) throw new Error(claimErr.message);
    if (!claim) throw new Error("Session not found.");

    const modRaw = claim.module;
    const mod = Array.isArray(modRaw) ? modRaw[0] : modRaw;
    if ((mod as { lecturer_id: string } | null)?.lecturer_id !== lecturerId) {
      throw new Error("Module not found or access denied.");
    }

    assertClaimEligibleForPrivateFeedback(claim);
    const institutionId = (mod as { institution_id: string }).institution_id;
    const categoryRatings = normalizeCategoryRatings(data.categoryRatings);
    const note = data.note?.trim() || null;

    if (!hasFeedbackContent(categoryRatings, note)) {
      throw new Error("Add at least one category rating or a short note.");
    }

    const now = new Date().toISOString();
    const payload = {
      claim_id: data.claimId,
      institution_id: institutionId,
      tutor_id: claim.tutor_id as string,
      author_id: lecturerId,
      category_ratings: categoryRatings,
      note,
      updated_at: now,
    };

    const { data: existing } = await supabase
      .from("private_session_feedback")
      .select("id")
      .eq("claim_id", data.claimId)
      .eq("author_id", lecturerId)
      .maybeSingle();

    let row;
    if (existing?.id) {
      const { data: updated, error: upErr } = await supabase
        .from("private_session_feedback")
        .update(payload)
        .eq("id", existing.id as string)
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
        .single();
      if (upErr) throw new Error(upErr.message);
      row = updated;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("private_session_feedback")
        .insert({ ...payload, created_at: now })
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
        .single();
      if (insErr) throw new Error(insErr.message);
      row = inserted;
    }

    await logInstitutionAudit(supabase, {
      institutionId,
      actorId: lecturerId,
      entityType: "SESSION_CLAIM",
      entityId: data.claimId,
      event: "PRIVATE_SESSION_FEEDBACK_UPSERT",
      payload: { feedbackId: row.id, hasNote: Boolean(note) },
    });

    if (note) {
      const moduleCode = (mod as { code: string }).code;
      await supabase.from("notifications").insert({
        recipient_id: claim.tutor_id as string,
        claim_id: data.claimId,
        channel: "IN_APP",
        type: "SYSTEM",
        subject: "Private session notes",
        body: `Your lecturer left private session notes for ${moduleCode}.`,
      });
    }

    return mapFeedbackRow(row);
  });

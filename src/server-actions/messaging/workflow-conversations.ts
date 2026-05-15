import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  buildMetadata,
  defaultTitleForType,
  METADATA_CATEGORY,
} from "./metadata-contract";
import {
  createWorkflowConversation,
  findWorkflowConversation,
  getUserInstitutionId,
  requireUserId,
} from "./helpers";

const claimSchema = z.object({ claimId: z.string().uuid() });
const disputeSchema = z.object({ disputeId: z.string().uuid() });

async function loadClaimParties(supabase: ReturnType<typeof createSupabaseServerClient>, claimId: string) {
  const { data: claim, error } = await supabase
    .from("session_claims")
    .select(
      `
      id,
      tutor_id,
      module_id,
      module:modules ( id, lecturer_id, code )
    `,
    )
    .eq("id", claimId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claim) throw new Error("Session claim not found.");

  const mod = Array.isArray(claim.module) ? claim.module[0] : claim.module;
  const lecturerId = mod?.lecturer_id as string | undefined;
  const tutorId = claim.tutor_id as string;

  if (!lecturerId) throw new Error("Module lecturer not found.");

  return {
    claimId: claim.id as string,
    tutorId,
    lecturerId,
    moduleId: claim.module_id as string,
    moduleCode: (mod?.code as string) ?? "Module",
  };
}

export const getOrCreateClaimConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => claimSchema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const parties = await loadClaimParties(supabase, data.claimId);

    const metadata = buildMetadata(METADATA_CATEGORY.CLAIM_DISCUSSION, {
      claim_id: parties.claimId,
      module_id: parties.moduleId,
      tutor_id: parties.tutorId,
      lecturer_id: parties.lecturerId,
    });

    const existing = await findWorkflowConversation(supabase, {
      userId,
      type: "CLAIM",
      metadataMatch: {
        claim_id: parties.claimId,
        category: METADATA_CATEGORY.CLAIM_DISCUSSION,
      },
    });
    if (existing) return { conversationId: existing };

    const institutionId = await getUserInstitutionId(supabase, userId);
    const conversationId = await createWorkflowConversation(supabase, {
      userId,
      institutionId,
      type: "CLAIM",
      title: `${parties.moduleCode} · Claim discussion`,
      metadata,
      participantIds: [parties.tutorId, parties.lecturerId],
    });

    return { conversationId };
  });

export const getOrCreateSessionConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => claimSchema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const parties = await loadClaimParties(supabase, data.claimId);

    const metadata = buildMetadata(METADATA_CATEGORY.SESSION_QUERY, {
      claim_id: parties.claimId,
      module_id: parties.moduleId,
      tutor_id: parties.tutorId,
      lecturer_id: parties.lecturerId,
    });

    const existing = await findWorkflowConversation(supabase, {
      userId,
      type: "SESSION",
      metadataMatch: {
        claim_id: parties.claimId,
        category: METADATA_CATEGORY.SESSION_QUERY,
      },
    });
    if (existing) return { conversationId: existing };

    const institutionId = await getUserInstitutionId(supabase, userId);
    const conversationId = await createWorkflowConversation(supabase, {
      userId,
      institutionId,
      type: "SESSION",
      title: defaultTitleForType("SESSION", metadata),
      metadata,
      participantIds: [parties.tutorId, parties.lecturerId],
    });

    return { conversationId };
  });

export const getOrCreateAttendanceConversationFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => claimSchema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const parties = await loadClaimParties(supabase, data.claimId);

    const metadata = buildMetadata(METADATA_CATEGORY.ATTENDANCE_ISSUE, {
      claim_id: parties.claimId,
      module_id: parties.moduleId,
      tutor_id: parties.tutorId,
      lecturer_id: parties.lecturerId,
    });

    const existing = await findWorkflowConversation(supabase, {
      userId,
      type: "ATTENDANCE",
      metadataMatch: {
        claim_id: parties.claimId,
        category: METADATA_CATEGORY.ATTENDANCE_ISSUE,
      },
    });
    if (existing) return { conversationId: existing };

    const institutionId = await getUserInstitutionId(supabase, userId);
    const conversationId = await createWorkflowConversation(supabase, {
      userId,
      institutionId,
      type: "ATTENDANCE",
      title: `${parties.moduleCode} · Attendance`,
      metadata,
      participantIds: [parties.tutorId, parties.lecturerId],
    });

    return { conversationId };
  });

export const getOrCreateDisputeConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => disputeSchema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const { data: dispute, error: dErr } = await supabase
      .from("disputes")
      .select("id, claim_id, raised_by_id")
      .eq("id", data.disputeId)
      .maybeSingle();

    if (dErr) throw new Error(dErr.message);
    if (!dispute) throw new Error("Dispute not found.");

    const parties = await loadClaimParties(
      supabase,
      dispute.claim_id as string,
    );

    const metadata = buildMetadata(METADATA_CATEGORY.CLAIM_DISPUTE, {
      claim_id: parties.claimId,
      dispute_id: dispute.id as string,
      module_id: parties.moduleId,
      tutor_id: parties.tutorId,
      lecturer_id: parties.lecturerId,
    });

    const existing = await findWorkflowConversation(supabase, {
      userId,
      type: "CLAIM",
      metadataMatch: {
        claim_id: parties.claimId,
        dispute_id: dispute.id as string,
        category: METADATA_CATEGORY.CLAIM_DISPUTE,
      },
    });
    if (existing) return { conversationId: existing };

    const institutionId = await getUserInstitutionId(supabase, userId);
    const conversationId = await createWorkflowConversation(supabase, {
      userId,
      institutionId,
      type: "CLAIM",
      title: `${parties.moduleCode} · Dispute`,
      metadata,
      participantIds: [parties.tutorId, parties.lecturerId],
    });

    return { conversationId };
  });

/** Lecturer-only: ensure DIRECT tutor thread uses metadata contract. */
export const getOrCreateDirectConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ tutorId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const institutionId = await getUserInstitutionId(supabase, lecturerId);

    const metadata = buildMetadata(METADATA_CATEGORY.TUTOR_DISCUSSION, {
      tutor_id: data.tutorId,
      lecturer_id: lecturerId,
    });

    const { data: existingParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", lecturerId);

    const convIds = (existingParticipants ?? []).map(
      (p) => p.conversation_id as string,
    );

    if (convIds.length) {
      const { data: matches } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", data.tutorId)
        .in("conversation_id", convIds);

      for (const m of matches ?? []) {
        const cid = m.conversation_id as string;
        const { data: conv } = await supabase
          .from("conversations")
          .select("id, type")
          .eq("id", cid)
          .eq("type", "DIRECT")
          .maybeSingle();
        if (conv?.id) return { conversationId: conv.id as string };
      }
    }

    return {
      conversationId: await createWorkflowConversation(supabase, {
        userId: lecturerId,
        institutionId,
        type: "DIRECT",
        title: "Tutor discussion",
        metadata,
        participantIds: [data.tutorId],
      }),
    };
  });

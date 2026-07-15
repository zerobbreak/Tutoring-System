import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  CONVERSATION_TYPES,
  conversationMetadataSchema,
  METADATA_CATEGORY,
  type ConversationMetadata,
  type ConversationType,
} from "./metadata-contract";
import {
  getUserInstitutionId,
  insertConversationWithParticipants,
  requireUserId,
  getOrCreateDirectConversation,
  resolveWorkflowConversationId,
  fetchConversationById,
} from "./helpers";

const createConversationSchema = z.object({
  type: z.enum(CONVERSATION_TYPES),
  participants: z.array(z.string().uuid()),
  title: z.string().optional(),
  metadata: conversationMetadataSchema.optional(),
});

const WORKFLOW_TYPES = ["CLAIM", "SESSION", "ATTENDANCE"] as const;

function workflowMetadataForType(
  type: ConversationType,
  metadata: ConversationMetadata,
): ConversationMetadata | null {
  const claimId = metadata.claim_id;
  if (!claimId) return null;

  switch (type) {
    case "CLAIM":
      if (metadata.dispute_id) {
        return {
          ...metadata,
          category: METADATA_CATEGORY.CLAIM_DISPUTE,
          claim_id: claimId,
        };
      }
      return {
        ...metadata,
        category: METADATA_CATEGORY.CLAIM_DISCUSSION,
        claim_id: claimId,
      };
    case "SESSION":
      return {
        ...metadata,
        category: METADATA_CATEGORY.SESSION_QUERY,
        claim_id: claimId,
      };
    case "ATTENDANCE":
      return {
        ...metadata,
        category: METADATA_CATEGORY.ATTENDANCE_ISSUE,
        claim_id: claimId,
      };
    default:
      return null;
  }
}

export const createConversationFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => createConversationSchema.parse(d))
  .handler(async ({ data: { type, participants, title, metadata } }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const institutionId = await getUserInstitutionId(supabase, userId);
    const meta = metadata ?? {};

    if (type === "DIRECT") {
      const otherUserId =
        participants.find((p) => p !== userId) || participants[0];
      if (!otherUserId) {
        throw new Error("Select a participant to message.");
      }
      const directMeta = conversationMetadataSchema.parse({
        category: METADATA_CATEGORY.TUTOR_DISCUSSION,
        ...meta,
        tutor_id: meta.tutor_id ?? otherUserId,
      });
      return getOrCreateDirectConversation(
        supabase,
        userId,
        otherUserId,
        institutionId,
        directMeta,
      );
    }

    if ((WORKFLOW_TYPES as readonly string[]).includes(type)) {
      const workflowMeta = workflowMetadataForType(type, meta);
      if (workflowMeta) {
        const existingId = await resolveWorkflowConversationId(supabase, {
          userId,
          type,
          metadataMatch: workflowMeta,
        });
        if (existingId) {
          return fetchConversationById(supabase, existingId);
        }
      }
    }

    return insertConversationWithParticipants(supabase, {
      type,
      title,
      metadata: meta,
      institutionId,
      participantIds: [...participants, userId],
    });
  });

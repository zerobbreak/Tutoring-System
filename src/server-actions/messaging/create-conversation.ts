import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { CONVERSATION_TYPES, conversationMetadataSchema } from "./metadata-contract";
import {
  getUserInstitutionId,
  insertConversationWithParticipants,
  requireUserId,
  getOrCreateDirectConversation,
} from "./helpers";

const createConversationSchema = z.object({
  type: z.enum(CONVERSATION_TYPES),
  participants: z.array(z.string().uuid()),
  title: z.string().optional(),
  metadata: conversationMetadataSchema.optional(),
});

export const createConversationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createConversationSchema.parse(d))
  .handler(async ({ data: { type, participants, title, metadata } }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const institutionId = await getUserInstitutionId(supabase, userId);

    if (type === "DIRECT") {
      const otherUserId = participants.find((p) => p !== userId) || participants[0];
      if (otherUserId) {
        return getOrCreateDirectConversation(
          supabase,
          userId,
          otherUserId,
          institutionId,
          metadata
        );
      }
    }

    return insertConversationWithParticipants(supabase, {
      type,
      title,
      metadata: metadata ?? {},
      institutionId,
      participantIds: [...participants, userId],
    });
  });


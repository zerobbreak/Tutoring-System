import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { CONVERSATION_TYPES, conversationMetadataSchema } from "./metadata-contract";
import { getUserInstitutionId, requireUserId } from "./helpers";

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

    const allParticipants = Array.from(new Set([...participants, userId]));

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({
        type,
        title,
        metadata: metadata ?? {},
        institution_id: institutionId,
      })
      .select()
      .single();

    if (convError) throw new Error(convError.message);

    const { error: partError } = await supabase
      .from("conversation_participants")
      .insert(
        allParticipants.map((pid) => ({
          conversation_id: conv.id,
          user_id: pid,
        })),
      );

    if (partError) throw new Error(partError.message);

    return conv;
  });

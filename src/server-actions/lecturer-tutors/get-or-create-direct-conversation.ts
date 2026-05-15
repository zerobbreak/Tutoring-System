import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const schema = z.object({
  tutorId: z.string().uuid(),
});

export const getOrCreateDirectConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: lecturerRow } = await supabase
      .from("users")
      .select("institution_id")
      .eq("id", lecturerId)
      .single();

    if (!lecturerRow?.institution_id) {
      throw new Error("Lecturer profile not found.");
    }

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

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({
        type: "DIRECT",
        institution_id: lecturerRow.institution_id,
        metadata: { tutor_id: data.tutorId, lecturer_id: lecturerId },
      })
      .select("id")
      .single();

    if (convError) throw new Error(convError.message);

    const { error: partError } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: conv.id, user_id: lecturerId },
        { conversation_id: conv.id, user_id: data.tutorId },
      ]);

    if (partError) throw new Error(partError.message);

    return { conversationId: conv.id as string };
  });

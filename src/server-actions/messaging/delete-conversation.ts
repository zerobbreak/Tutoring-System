import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "./helpers";

const deleteConversationSchema = z.object({
  conversationId: z.string().uuid(),
});

export const deleteConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteConversationSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const { data: membership, error: memberErr } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberErr) throw new Error(memberErr.message);
    if (!membership) {
      throw new Error("Conversation not found or you are not a participant.");
    }

    const client = getSupabaseAdmin() ?? supabase;
    const { error } = await client
      .from("conversations")
      .delete()
      .eq("id", data.conversationId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

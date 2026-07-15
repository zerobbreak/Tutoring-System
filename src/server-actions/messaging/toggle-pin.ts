import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "./helpers";

const schema = z.object({
  conversationId: z.string().uuid(),
  pinned: z.boolean().optional(),
});

export const togglePinConversationFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const { data: row, error: fetchErr } = await supabase
      .from("conversation_participants")
      .select("is_pinned")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Not a participant in this conversation.");

    const nextPinned =
      data.pinned !== undefined ? data.pinned : !Boolean(row.is_pinned);

    const { error } = await supabase
      .from("conversation_participants")
      .update({ is_pinned: nextPinned })
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { is_pinned: nextPinned };
  });

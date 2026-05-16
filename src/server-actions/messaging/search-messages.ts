import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "./helpers";
import type { MessageSearchResultDTO } from "./types";

const schema = z.object({
  query: z.string().min(1).max(200),
  conversationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional().default(30),
});

export const searchMessagesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<MessageSearchResultDTO[]> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const { data: rows, error } = await supabase.rpc("messaging_search", {
      p_user_id: userId,
      p_query: data.query.trim(),
      p_conversation_id: data.conversationId ?? null,
      p_limit: data.limit,
    });

    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: Record<string, unknown>) => ({
      message_id: r.message_id as string,
      conversation_id: r.conversation_id as string,
      content: r.content as string,
      created_at: r.created_at as string,
      sender_id: r.sender_id as string,
      rank: Number(r.rank) || 0,
    }));
  });

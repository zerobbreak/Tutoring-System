import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  CONVERSATION_TYPES,
  conversationMetadataSchema,
  type ConversationType,
} from "./metadata-contract";
import { requireUserId, unwrapUser } from "./helpers";
import type { ConversationDTO, MessageDTO, ParticipantDTO } from "./types";

const listConversationsSchema = z.object({
  type: z.enum(CONVERSATION_TYPES).optional(),
});

export const listConversationsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listConversationsSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const type = data.type;
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    let partQuery = supabase
      .from("conversation_participants")
      .select(
        `
        conversation_id,
        last_read_at,
        is_pinned,
        conversation:conversations (
          id,
          title,
          type,
          metadata,
          updated_at
        )
      `,
      )
      .eq("user_id", userId);

    const { data: partRows, error: partErr } = await partQuery;
    if (partErr) throw new Error(partErr.message);

    let rows = (partRows ?? []).filter((r) => r.conversation);
    if (type) {
      rows = rows.filter((r) => {
        const conv = Array.isArray(r.conversation)
          ? r.conversation[0]
          : r.conversation;
        return conv?.type === type;
      });
    }
    if (!rows.length) return [];

    const convIds = rows.map((r) => r.conversation_id as string);

    const unreadRes = await supabase.rpc("messaging_unread_counts", {
      p_user_id: userId,
    });

    const [{ data: allParticipants }, { data: recentMsgs }] = await Promise.all([
        supabase
          .from("conversation_participants")
          .select(
            `
            conversation_id,
            user_id,
            is_pinned,
            last_read_at,
            user:users ( full_name, email, role )
          `,
          )
          .in("conversation_id", convIds),
        supabase
          .from("messages")
          .select(
            `
            id,
            conversation_id,
            content,
            created_at,
            sender_id,
            parent_message_id,
            metadata,
            sender:users ( full_name )
          `,
          )
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false })
          .limit(Math.min(convIds.length * 3, 200)),
    ]);

    const unreadByConv = new Map<string, number>();
    if (!unreadRes.error) {
      for (const u of unreadRes.data ?? []) {
        unreadByConv.set(
          u.conversation_id as string,
          Number(u.unread_count) || 0,
        );
      }
    } else if (recentMsgs) {
      const lastReadByConv = new Map(
        rows.map((r) => [r.conversation_id as string, r.last_read_at as string]),
      );
      for (const m of recentMsgs) {
        const cid = m.conversation_id as string;
        const lastRead = lastReadByConv.get(cid);
        if (lastRead && (m.created_at as string) > lastRead) {
          unreadByConv.set(cid, (unreadByConv.get(cid) ?? 0) + 1);
        }
      }
    }

    const participantsByConv = new Map<string, ParticipantDTO[]>();
    for (const p of allParticipants ?? []) {
      const cid = p.conversation_id as string;
      const user = unwrapUser(
        p.user as
          | { full_name: string; email: string; role: string }
          | { full_name: string; email: string; role: string }[]
          | null,
      );
      const list = participantsByConv.get(cid) ?? [];
      list.push({
        user_id: p.user_id as string,
        full_name: user?.full_name ?? "Unknown",
        email: user?.email ?? "",
        role: user?.role ?? "",
        last_read_at: p.last_read_at as string | null,
        is_pinned: Boolean(p.is_pinned),
      });
      participantsByConv.set(cid, list);
    }

    const lastMsgByConv = new Map<string, MessageDTO>();
    for (const m of recentMsgs ?? []) {
      const cid = m.conversation_id as string;
      if (lastMsgByConv.has(cid)) continue;
      const sender = unwrapUser(
        m.sender as { full_name: string } | { full_name: string }[] | null,
      );
      lastMsgByConv.set(cid, {
        id: m.id as string,
        conversation_id: cid,
        sender_id: m.sender_id as string,
        sender_name: sender?.full_name ?? "Unknown",
        content: m.content as string,
        parent_message_id: m.parent_message_id as string | null,
        metadata: m.metadata ?? {},
        created_at: m.created_at as string,
        attachments: [],
      });
    }

    const result: ConversationDTO[] = rows.map((row) => {
      const conv = Array.isArray(row.conversation)
        ? row.conversation[0]
        : row.conversation;
      const id = conv.id as string;
      const meta = conversationMetadataSchema.safeParse(conv.metadata ?? {});
      return {
        id,
        title: conv.title as string | null,
        type: conv.type as ConversationType,
        metadata: meta.success ? meta.data : {},
        updated_at: conv.updated_at as string,
        unread_count: unreadByConv.get(id) ?? 0,
        last_message: lastMsgByConv.get(id),
        participants: participantsByConv.get(id) ?? [],
        my_is_pinned: Boolean(row.is_pinned),
      };
    });

    result.sort((a, b) => {
      const aPin = a.my_is_pinned ? 1 : 0;
      const bPin = b.my_is_pinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

    return result;
  });

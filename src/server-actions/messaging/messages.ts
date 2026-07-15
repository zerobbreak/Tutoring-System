import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { requireUserId, unwrapUser } from "./helpers";
import type { MessageAttachmentDTO, MessageDTO } from "./types";

const BUCKET = "message_attachments";
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const getMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const attachmentInputSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileBase64: z.string().min(1),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
  parentMessageId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  attachments: z.array(attachmentInputSchema).max(5).optional(),
});

const markReadSchema = z.object({
  conversationId: z.string().uuid(),
});

function mapAttachments(rows: unknown[]): MessageAttachmentDTO[] {
  return (rows as Record<string, unknown>[]).map((a) => ({
    id: a.id as string,
    file_name: a.file_name as string,
    file_url: a.file_url as string,
    mime_type: a.mime_type as string,
    size_bytes: (a.size_bytes as number) ?? null,
  }));
}

export const getConversationMessagesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => getMessagesSchema.parse(input ?? {}))
  // @ts-expect-error TanStack ServerFn handler inference
  .handler(async ({ data: input }) => {
    const { conversationId, limit, offset } = input;
    const supabase = createSupabaseServerClient();
    await requireUserId(supabase);

    const { data: rows, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:users ( full_name ),
        attachments:message_attachments (
          id,
          file_name,
          file_url,
          mime_type,
          size_bytes
        )
      `,
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    return (rows ?? []).map((m) => {
      const sender = unwrapUser(
        m.sender as { full_name: string } | { full_name: string }[] | null,
      );
      return {
        id: m.id as string,
        conversation_id: m.conversation_id as string,
        sender_id: m.sender_id as string,
        sender_name: sender?.full_name ?? "Unknown",
        content: m.content as string,
        parent_message_id: m.parent_message_id as string | null,
        metadata: (m.metadata as Record<string, unknown>) ?? {},
        created_at: m.created_at as string,
        attachments: mapAttachments(
          (m.attachments as unknown[]) ?? [],
        ),
      };
    }) as MessageDTO[];
  });

export const sendMessageFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => sendMessageSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const admin = getSupabaseAdmin();
    const storageClient = admin ?? supabase;

    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        content: data.content,
        parent_message_id: data.parentMessageId,
        metadata: data.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const messageId = msg.id as string;

    if (data.attachments?.length) {
      for (const file of data.attachments) {
        const buf = Buffer.from(file.fileBase64, "base64");
        if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
          throw new Error("Attachment too large (max 25MB).");
        }
        const safeName = file.fileName.replace(/[^\w.\-()+ ]/g, "_").slice(0, 200);
        const objectPath = `${data.conversationId}/${messageId}/${crypto.randomUUID()}_${safeName}`;

        const { error: upErr } = await storageClient.storage
          .from(BUCKET)
          .upload(objectPath, buf, {
            contentType: file.mimeType,
            upsert: false,
          });

        if (upErr) throw new Error(upErr.message);

        const storageRef = `${BUCKET}/${objectPath}`;

        const { error: attErr } = await supabase.from("message_attachments").insert({
          message_id: messageId,
          file_url: storageRef,
          file_name: file.fileName,
          mime_type: file.mimeType,
          size_bytes: buf.byteLength,
        });

        if (attErr) throw new Error(attErr.message);
      }
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    return { id: messageId };
  });

export const markConversationAsReadFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => markReadSchema.parse(d))
  .handler(async ({ data: { conversationId } }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const { error } = await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .match({ conversation_id: conversationId, user_id: userId });

    if (error) throw new Error(error.message);
    return { success: true };
  });

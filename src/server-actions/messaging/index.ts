import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";

// --- Types ---

export type ConversationType = 'DIRECT' | 'GROUP' | 'SESSION' | 'CLAIM' | 'ATTENDANCE';

export type ConversationDTO = {
  id: string;
  title: string | null;
  type: ConversationType;
  metadata: any;
  updated_at: string;
  last_message?: MessageDTO;
  unread_count: number;
  participants: ParticipantDTO[];
};

export type ParticipantDTO = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  last_read_at: string | null;
  is_pinned: boolean;
};

export type MessageDTO = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  parent_message_id: string | null;
  metadata: any;
  created_at: string;
};

// --- Schemas ---

const listConversationsSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP', 'SESSION', 'CLAIM', 'ATTENDANCE']).optional(),
});

const getMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
  parentMessageId: z.string().uuid().optional(),
  metadata: z.any().optional(),
});

const markReadSchema = z.object({
  conversationId: z.string().uuid(),
});

const createConversationSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP', 'SESSION', 'CLAIM', 'ATTENDANCE']),
  participants: z.array(z.string().uuid()),
  title: z.string().optional(),
  metadata: z.any().optional(),
});

const searchUsersSchema = z.object({
  query: z.string(),
});

// --- Helper ---

async function requireUserId(supabase: ReturnType<typeof createSupabaseServerClient>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

// --- Actions ---

/**
 * Lists conversations for the current user.
 */
export const listConversationsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listConversationsSchema.parse(d))
  .handler(async ({ data: { type } }) => {
    const supabase = await createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    let query = supabase
      .from('conversations')
      .select(`
        *,
        participants:conversation_participants(
          user_id,
          is_pinned,
          last_read_at,
          user:users(full_name, email, role)
        ),
        messages(
          id,
          content,
          created_at,
          sender_id,
          sender:users(full_name)
        )
      `)
      .order('updated_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((conv: any) => {
      const lastMsg = conv.messages?.length > 0 ? conv.messages[conv.messages.length - 1] : null;
      const myParticipant = conv.participants.find((p: any) => p.user_id === userId);
      
      // Calculate unread count (messages newer than last_read_at)
      const unreadCount = myParticipant?.last_read_at 
        ? conv.messages.filter((m: any) => m.created_at > myParticipant.last_read_at).length
        : conv.messages.length;

      return {
        id: conv.id,
        title: conv.title,
        type: conv.type,
        metadata: conv.metadata,
        updated_at: conv.updated_at,
        unread_count: unreadCount,
        last_message: lastMsg ? {
          id: lastMsg.id,
          conversation_id: conv.id,
          content: lastMsg.content,
          sender_id: lastMsg.sender_id,
          sender_name: lastMsg.sender?.full_name || 'Unknown',
          parent_message_id: lastMsg.parent_message_id || null,
          metadata: lastMsg.metadata || {},
          created_at: lastMsg.created_at,
        } : undefined,
        participants: conv.participants.map((p: any) => ({
          user_id: p.user_id,
          full_name: p.user?.full_name || 'Unknown',
          email: p.user?.email || '',
          role: p.user?.role || '',
          last_read_at: p.last_read_at,
          is_pinned: p.is_pinned,
        })),
      };
    }) as ConversationDTO[];
  });

/**
 * Fetches message history for a conversation.
 */
export const getConversationMessagesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => getMessagesSchema.parse(d))
  .handler(async ({ data: { conversationId, limit, offset } }) => {
    const supabase = await createSupabaseServerClient();
    await requireUserId(supabase);

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(full_name)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return (data || []).map((m: any) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      sender_name: m.sender?.full_name || 'Unknown',
      content: m.content,
      parent_message_id: m.parent_message_id,
      metadata: m.metadata,
      created_at: m.created_at,
    })) as MessageDTO[];
  });

/**
 * Sends a message in a conversation.
 */
export const sendMessageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sendMessageSchema.parse(d))
  .handler(async ({ data: { conversationId, content, parentMessageId, metadata } }) => {
    const supabase = await createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    // Insert message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        parent_message_id: parentMessageId,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  });

/**
 * Marks all messages in a conversation as read for the current user.
 */
export const markConversationAsReadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => markReadSchema.parse(d))
  .handler(async ({ data: { conversationId } }) => {
    const supabase = await createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const { error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .match({ conversation_id: conversationId, user_id: userId });

    if (error) throw error;
    return { success: true };
  });

/**
 * Creates a new conversation.
 */
export const createConversationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createConversationSchema.parse(d))
  .handler(async ({ data: { type, participants, title, metadata } }) => {
    const supabase = await createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    // Ensure current user is in participants
    const allParticipants = Array.from(new Set([...participants, userId]));

    // Start transaction (manual via Supabase)
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        type,
        title,
        metadata: metadata || {},
        institution_id: (await supabase.from('users').select('institution_id').eq('id', userId).single()).data?.institution_id
      })
      .select()
      .single();

    if (convError) throw convError;

    const participantInserts = allParticipants.map(pid => ({
      conversation_id: conv.id,
      user_id: pid,
    }));

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participantInserts);

    if (partError) throw partError;

    return conv;
  });

/**
 * Searches for users to start a conversation with.
 */
export const searchUsersFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => searchUsersSchema.parse(d))
  .handler(async ({ data: { query } }) => {
    const supabase = await createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    // Get current user's institution
    const { data: currentUser } = await supabase
      .from('users')
      .select('institution_id')
      .eq('id', userId)
      .single();

    if (!currentUser) throw new Error("User not found");

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('institution_id', currentUser.institution_id)
      .neq('id', userId) // Don't include self
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;
    return data;
  });

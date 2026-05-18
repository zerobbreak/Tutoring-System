import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { ConversationMetadata, ConversationType } from "./metadata-contract";


export async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

export async function getUserInstitutionId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .select("institution_id")
    .eq("id", userId)
    .single();

  if (error || !data?.institution_id) {
    throw new Error("User profile not found.");
  }
  return data.institution_id as string;
}

export function unwrapUser<T extends { full_name: string }>(
  row: T | T[] | null,
): T | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

type FindWorkflowParams = {
  userId: string;
  type: ConversationType;
  metadataMatch: ConversationMetadata;
};

/** Find an existing workflow thread the user already participates in. */
export async function findWorkflowConversation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  { userId, type, metadataMatch }: FindWorkflowParams,
): Promise<string | null> {
  const { data: myRows } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  const convIds = (myRows ?? []).map((r) => r.conversation_id as string);
  if (!convIds.length) return null;

  let query = supabase
    .from("conversations")
    .select("id, metadata")
    .eq("type", type)
    .in("id", convIds);

  const { category, claim_id, dispute_id, scheduled_session_id, ...rest } =
    metadataMatch;
  const contains: Record<string, string> = {};
  if (claim_id) contains.claim_id = claim_id;
  if (dispute_id) contains.dispute_id = dispute_id;
  if (scheduled_session_id) contains.scheduled_session_id = scheduled_session_id;
  if (category) contains.category = category;
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === "string") contains[k] = v;
  }
  if (Object.keys(contains).length) {
    query = query.contains("metadata", contains);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string) ?? null;
}

/** Insert conversation + participants, then load the row (SELECT RLS requires participation). */
export async function insertConversationWithParticipants(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: {
    type: ConversationType;
    title?: string | null;
    metadata: ConversationMetadata | Record<string, unknown>;
    institutionId: string;
    participantIds: string[];
  },
) {
  const conversationId = crypto.randomUUID();
  const participantIds = Array.from(new Set(params.participantIds));

  const { error: convError } = await supabase.from("conversations").insert({
    id: conversationId,
    type: params.type,
    title: params.title ?? null,
    metadata: params.metadata,
    institution_id: params.institutionId,
  });

  if (convError) throw new Error(convError.message);

  const { error: partError } = await supabase
    .from("conversation_participants")
    .insert(
      participantIds.map((user_id) => ({
        conversation_id: conversationId,
        user_id,
      })),
    );

  if (partError) throw new Error(partError.message);

  const { data: conv, error: fetchError } = await supabase
    .from("conversations")
    .select()
    .eq("id", conversationId)
    .single();

  if (fetchError || !conv) {
    throw new Error(fetchError?.message ?? "Conversation not found");
  }
  return conv;
}

export async function createWorkflowConversation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: {
    userId: string;
    institutionId: string;
    type: ConversationType;
    title: string;
    metadata: ConversationMetadata;
    participantIds: string[];
  },
): Promise<string> {
  const conv = await insertConversationWithParticipants(supabase, {
    type: params.type,
    title: params.title,
    metadata: params.metadata,
    institutionId: params.institutionId,
    participantIds: [...params.participantIds, params.userId],
  });
  return conv.id as string;
}

/** Find an existing DIRECT conversation between two users, clean up duplicates if they exist, and return the unique conversation. */
export async function getOrCreateDirectConversation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  otherUserId: string,
  institutionId: string,
  metadata?: Record<string, unknown>,
) {
  // Find all conversation participants rows for userId
  const { data: myPart } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  const myConvIds = (myPart ?? []).map((r) => r.conversation_id as string);

  let existingDirectConvIds: string[] = [];

  if (myConvIds.length > 0) {
    // Find all those conversations where otherUserId is also a participant
    const { data: otherPart } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myConvIds);

    const sharedConvIds = (otherPart ?? []).map((r) => r.conversation_id as string);

    if (sharedConvIds.length > 0) {
      // Filter for conversations of type "DIRECT"
      const { data: directConvs } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "DIRECT")
        .in("id", sharedConvIds);

      existingDirectConvIds = (directConvs ?? []).map((c) => c.id as string);
    }
  }

  if (existingDirectConvIds.length > 0) {
    // If there is only one conversation and it works, we just return it
    if (existingDirectConvIds.length === 1) {
      const { data: conv } = await supabase
        .from("conversations")
        .select()
        .eq("id", existingDirectConvIds[0])
        .single();
      if (conv) return conv;
    }

    // Otherwise, we perform cleanup/deduplication on all existing ones
    const { data: convDetails } = await supabase
      .from("conversations")
      .select("id, updated_at")
      .in("id", existingDirectConvIds);

    if (convDetails && convDetails.length > 0) {
      // Find message counts for all of them to preserve history
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convDetails.map((c) => c.id));

      const msgCounts = new Map<string, number>();
      for (const m of messages ?? []) {
        const cid = m.conversation_id as string;
        msgCounts.set(cid, (msgCounts.get(cid) ?? 0) + 1);
      }

      // Associate score: message count primary, last updated secondary
      const scored = convDetails.map((c) => {
        const count = msgCounts.get(c.id) ?? 0;
        const time = c.updated_at ? new Date(c.updated_at).getTime() : 0;
        return {
          id: c.id,
          score: count * 1000000000000 + time,
        };
      });

      scored.sort((a, b) => b.score - a.score);

      const keepId = scored[0].id;
      const duplicateIds = scored.slice(1).map((s) => s.id);

      if (duplicateIds.length > 0) {
        // Use admin client to bypass RLS for deletion
        const adminClient = getSupabaseAdmin();
        if (adminClient) {
          await adminClient.from("conversations").delete().in("id", duplicateIds);
        } else {
          // Fallback to user client if admin client isn't available
          await supabase.from("conversations").delete().in("id", duplicateIds);
        }
      }

      const { data: conv } = await supabase
        .from("conversations")
        .select()
        .eq("id", keepId)
        .single();

      if (conv) return conv;
    }
  }

  // If none exists, create a new one!
  return insertConversationWithParticipants(supabase, {
    type: "DIRECT",
    metadata: metadata ?? {},
    institutionId,
    participantIds: [otherUserId, userId],
  });
}


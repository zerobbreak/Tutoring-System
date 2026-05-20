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

function metadataContainsFilter(
  metadataMatch: ConversationMetadata,
): Record<string, string> {
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
  return contains;
}

async function participantConversationIds(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<string[]> {
  const { data: myRows } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  return (myRows ?? []).map((r) => r.conversation_id as string);
}

/** Find workflow threads matching type + metadata (strict, then claim_id-only fallback). */
export async function findAllWorkflowConversations(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  { userId, type, metadataMatch }: FindWorkflowParams,
): Promise<string[]> {
  const convIds = await participantConversationIds(supabase, userId);
  if (!convIds.length) return [];

  const contains = metadataContainsFilter(metadataMatch);

  const runQuery = async (filter: Record<string, string>) => {
    let query = supabase
      .from("conversations")
      .select("id")
      .eq("type", type)
      .in("id", convIds);
    if (Object.keys(filter).length) {
      query = query.contains("metadata", filter);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.id as string);
  };

  let ids = await runQuery(contains);
  if (
    ids.length === 0 &&
    metadataMatch.claim_id &&
    metadataMatch.category
  ) {
    ids = await runQuery({ claim_id: metadataMatch.claim_id });
  }
  return ids;
}

/** Find an existing workflow thread the user already participates in. */
export async function findWorkflowConversation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: FindWorkflowParams,
): Promise<string | null> {
  const ids = await findAllWorkflowConversations(supabase, params);
  return ids[0] ?? null;
}

async function scoreConversationsByActivity(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  convIds: string[],
): Promise<string | null> {
  if (!convIds.length) return null;
  if (convIds.length === 1) return convIds[0]!;

  const { data: convDetails } = await supabase
    .from("conversations")
    .select("id, updated_at")
    .in("id", convIds);

  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", convIds);

  const msgCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    const cid = m.conversation_id as string;
    msgCounts.set(cid, (msgCounts.get(cid) ?? 0) + 1);
  }

  const scored = (convDetails ?? []).map((c) => {
    const count = msgCounts.get(c.id) ?? 0;
    const time = c.updated_at ? new Date(c.updated_at).getTime() : 0;
    return { id: c.id as string, score: count * 1_000_000_000_000 + time };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? convIds[0]!;
}

/** Remove duplicate threads, keeping the one with the most history. */
export async function dedupeConversationsKeepingBest(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  convIds: string[],
): Promise<string | null> {
  if (!convIds.length) return null;
  const keepId = await scoreConversationsByActivity(supabase, convIds);
  if (!keepId) return null;

  const duplicateIds = convIds.filter((id) => id !== keepId);
  if (duplicateIds.length > 0) {
    const adminClient = getSupabaseAdmin();
    const client = adminClient ?? supabase;
    await client.from("conversations").delete().in("id", duplicateIds);
  }
  return keepId;
}

export async function resolveWorkflowConversationId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: FindWorkflowParams,
): Promise<string | null> {
  const ids = await findAllWorkflowConversations(supabase, params);
  if (!ids.length) return null;
  return dedupeConversationsKeepingBest(supabase, ids);
}

async function sharedConversationIdsBetweenUsers(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  otherUserId: string,
): Promise<string[]> {
  const myConvIds = await participantConversationIds(supabase, userId);
  if (!myConvIds.length) return [];

  const { data: otherPart } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", otherUserId)
    .in("conversation_id", myConvIds);

  return (otherPart ?? []).map((r) => r.conversation_id as string);
}

async function findAllDirectConversationsByMetadata(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  otherUserId: string,
  metadataMatch: ConversationMetadata,
): Promise<string[]> {
  const sharedConvIds = await sharedConversationIdsBetweenUsers(
    supabase,
    userId,
    otherUserId,
  );
  if (!sharedConvIds.length) return [];

  const contains = metadataContainsFilter(metadataMatch);
  let query = supabase
    .from("conversations")
    .select("id")
    .eq("type", "DIRECT")
    .in("id", sharedConvIds);

  if (Object.keys(contains).length) {
    query = query.contains("metadata", contains);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
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

/** Find or create a DIRECT thread scoped by metadata (topic), not just user pair. */
export async function getOrCreateDirectConversation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  otherUserId: string,
  institutionId: string,
  metadata: ConversationMetadata,
) {
  const existingIds = await findAllDirectConversationsByMetadata(
    supabase,
    userId,
    otherUserId,
    metadata,
  );

  if (existingIds.length > 0) {
    const keepId = await dedupeConversationsKeepingBest(supabase, existingIds);
    if (keepId) {
      const { data: conv } = await supabase
        .from("conversations")
        .select()
        .eq("id", keepId)
        .single();
      if (conv) return conv;
    }
  }

  return insertConversationWithParticipants(supabase, {
    type: "DIRECT",
    metadata,
    institutionId,
    participantIds: [otherUserId, userId],
  });
}

export async function fetchConversationById(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  conversationId: string,
) {
  const { data: conv, error } = await supabase
    .from("conversations")
    .select()
    .eq("id", conversationId)
    .single();
  if (error || !conv) {
    throw new Error(error?.message ?? "Conversation not found");
  }
  return conv;
}


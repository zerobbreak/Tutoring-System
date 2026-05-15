import type { createSupabaseServerClient } from "#/lib/supabase-server";
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
  const allParticipants = Array.from(
    new Set([...params.participantIds, params.userId]),
  );

  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({
      type: params.type,
      title: params.title,
      metadata: params.metadata,
      institution_id: params.institutionId,
    })
    .select("id")
    .single();

  if (convError) throw new Error(convError.message);

  const { error: partError } = await supabase
    .from("conversation_participants")
    .insert(
      allParticipants.map((user_id) => ({
        conversation_id: conv.id,
        user_id,
      })),
    );

  if (partError) throw new Error(partError.message);
  return conv.id as string;
}

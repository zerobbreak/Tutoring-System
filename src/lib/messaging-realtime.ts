import { supabase } from "#/lib/supabase";

export type IncomingMessageRow = {
  id: string;
  conversation_id: string;
  content: string;
  sender_id: string;
  parent_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function subscribeToIncomingMessages(
  userId: string,
  onInsert: (message: IncomingMessageRow) => void,
) {
  const channel = supabase
    .channel(`incoming-messages:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        onInsert(payload.new as IncomingMessageRow);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function fetchMessageSenderName(
  senderId: string,
): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", senderId)
    .maybeSingle();
  return (data?.full_name as string | undefined) ?? "Someone";
}

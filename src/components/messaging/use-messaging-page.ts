import * as React from "react";
import { toast } from "sonner";
import { subscribeToIncomingMessages } from "#/lib/messaging-realtime";
import { supabase } from "#/lib/supabase";
import {
  deleteConversationFn,
  getConversationMessagesFn,
  listConversationsFn,
  markConversationAsReadFn,
  sendMessageFn,
  type ConversationDTO,
  type MessageDTO,
} from "#/server-actions/messaging";

type UseMessagingPageOptions = {
  initialConversationId?: string;
};

export function useMessagingPage({ initialConversationId }: UseMessagingPageOptions = {}) {
  const [conversations, setConversations] = React.useState<ConversationDTO[]>([]);
  const [selectedConvId, setSelectedConvId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<MessageDTO[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false);

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  const refreshConversations = React.useCallback(async (): Promise<ConversationDTO[]> => {
    const convs = (await listConversationsFn({ data: {} })) as ConversationDTO[];
    setConversations(convs);
    return convs;
  }, []);

  React.useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const convs = await refreshConversations();

        if (initialConversationId) {
          setSelectedConvId(initialConversationId);
        } else if (convs.length > 0) {
          setSelectedConvId(convs[0]!.id);
        }
      } catch (err) {
        console.error("Failed to init messaging:", err);
        toast.error("Failed to load conversations");
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, [initialConversationId, refreshConversations]);

  React.useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    async function fetchMessages() {
      setIsMessagesLoading(true);
      try {
        const msgs = (await getConversationMessagesFn({
          data: { conversationId: selectedConvId },
        })) as MessageDTO[];
        setMessages(msgs);
        await markConversationAsReadFn({
          data: { conversationId: selectedConvId },
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId ? { ...c, unread_count: 0 } : c,
          ),
        );
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        toast.error("Failed to load message history");
      } finally {
        setIsMessagesLoading(false);
      }
    }
    void fetchMessages();
  }, [selectedConvId]);

  React.useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToIncomingMessages(currentUserId, async (newMsg) => {
          if (newMsg.conversation_id === selectedConvId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [
                ...prev,
                {
                  id: newMsg.id,
                  conversation_id: newMsg.conversation_id,
                  sender_id: newMsg.sender_id,
                  sender_name:
                    newMsg.sender_id === currentUserId ? "You" : "Participant",
                  content: newMsg.content,
                  parent_message_id: newMsg.parent_message_id,
                  metadata: newMsg.metadata ?? {},
                  created_at: newMsg.created_at,
                  attachments: [],
                },
              ];
            });
            await markConversationAsReadFn({
              data: { conversationId: selectedConvId },
            });
          }

          setConversations((prev) => {
            const index = prev.findIndex((c) => c.id === newMsg.conversation_id);
            if (index === -1) {
              void refreshConversations();
              return prev;
            }

            const updated = [...prev];
            const conv = updated[index]!;
            updated[index] = {
              ...conv,
              updated_at: newMsg.created_at,
              last_message: {
                id: newMsg.id,
                conversation_id: newMsg.conversation_id,
                content: newMsg.content,
                sender_id: newMsg.sender_id,
                sender_name:
                  newMsg.sender_id === currentUserId ? "You" : "Participant",
                parent_message_id: newMsg.parent_message_id,
                metadata: newMsg.metadata ?? {},
                created_at: newMsg.created_at,
                attachments: [],
              },
              unread_count:
                newMsg.conversation_id === selectedConvId
                  ? 0
                  : conv.unread_count + 1,
            };

            const item = updated.splice(index, 1)[0]!;
            updated.unshift(item);
            return updated;
          });
    });

    return unsubscribe;
  }, [selectedConvId, currentUserId, refreshConversations]);

  const handleSendMessage = async (
    content: string,
    attachments?: { fileName: string; mimeType: string; fileBase64: string }[],
  ) => {
    if (!selectedConvId) return;
    try {
      await sendMessageFn({
        data: {
          conversationId: selectedConvId,
          content,
          attachments,
        },
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
    }
  };

  const handleConversationCreated = async (id: string) => {
    await refreshConversations();
    setSelectedConvId(id);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConvId) return;
    await deleteConversationFn({ data: { conversationId: selectedConvId } });
    setConversations((prev) => prev.filter((c) => c.id !== selectedConvId));
    setSelectedConvId(undefined);
    setMessages([]);
    toast.success("Conversation deleted");
  };

  return {
    conversations,
    setConversations,
    selectedConvId,
    setSelectedConvId,
    selectedConversation,
    messages,
    currentUserId,
    isLoading,
    isMessagesLoading,
    refreshConversations,
    handleSendMessage,
    handleConversationCreated,
    handleDeleteConversation,
  };
}

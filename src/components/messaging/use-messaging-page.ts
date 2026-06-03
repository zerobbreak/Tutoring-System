import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { subscribeToIncomingMessages } from "#/lib/messaging-realtime";
import { formatQueryError } from "#/lib/query-error";
import { queryKeys } from "#/lib/query-keys";
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
  const queryClient = useQueryClient();
  const [selectedConvId, setSelectedConvId] = React.useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [initialized, setInitialized] = React.useState(false);

  const conversationsQuery = useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: () => listConversationsFn({ data: {} }) as Promise<ConversationDTO[]>,
    enabled: !!currentUserId,
  });

  const conversations = conversationsQuery.data ?? [];

  const messagesQuery = useQuery({
    queryKey: selectedConvId
      ? queryKeys.messaging.messages(selectedConvId)
      : ["messaging", "messages", "none"],
    queryFn: () =>
      getConversationMessagesFn({
        data: { conversationId: selectedConvId! },
      }) as Promise<MessageDTO[]>,
    enabled: !!selectedConvId,
  });

  const messages = messagesQuery.data ?? [];
  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  React.useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
      } catch (err) {
        console.error("Failed to init messaging:", err);
        toast.error("Failed to load conversations");
      } finally {
        setInitialized(true);
      }
    }
    void init();
  }, []);

  React.useEffect(() => {
    if (!conversationsQuery.isSuccess || selectedConvId) return;

    if (initialConversationId) {
      setSelectedConvId(initialConversationId);
    } else if (conversations.length > 0) {
      setSelectedConvId(conversations[0]!.id);
    }
  }, [
    conversations,
    conversationsQuery.isSuccess,
    initialConversationId,
    selectedConvId,
  ]);

  React.useEffect(() => {
    if (!selectedConvId || !messagesQuery.isSuccess) return;

    void markConversationAsReadFn({
      data: { conversationId: selectedConvId },
    }).then(() => {
      queryClient.setQueryData<ConversationDTO[]>(
        queryKeys.messaging.conversations,
        (prev) =>
          prev?.map((c) =>
            c.id === selectedConvId ? { ...c, unread_count: 0 } : c,
          ) ?? prev,
      );
    });
  }, [messagesQuery.isSuccess, queryClient, selectedConvId]);

  React.useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToIncomingMessages(currentUserId, async (newMsg) => {
      if (newMsg.conversation_id === selectedConvId) {
        queryClient.setQueryData<MessageDTO[]>(
          queryKeys.messaging.messages(selectedConvId),
          (prev) => {
            if (prev?.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...(prev ?? []),
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
          },
        );
        await markConversationAsReadFn({
          data: { conversationId: selectedConvId },
        });
      }

      queryClient.setQueryData<ConversationDTO[]>(
        queryKeys.messaging.conversations,
        (prev) => {
          if (!prev) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.messaging.conversations,
            });
            return prev;
          }

          const index = prev.findIndex((c) => c.id === newMsg.conversation_id);
          if (index === -1) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.messaging.conversations,
            });
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
        },
      );
    });

    return unsubscribe;
  }, [currentUserId, queryClient, selectedConvId]);

  const refreshConversations = React.useCallback(async (): Promise<ConversationDTO[]> => {
    const result = await queryClient.fetchQuery({
      queryKey: queryKeys.messaging.conversations,
      queryFn: () => listConversationsFn({ data: {} }) as Promise<ConversationDTO[]>,
    });
    return result;
  }, [queryClient]);

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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messaging.messages(selectedConvId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.messaging.conversations,
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
    queryClient.removeQueries({
      queryKey: queryKeys.messaging.messages(selectedConvId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.messaging.conversations,
    });
    setSelectedConvId(undefined);
    toast.success("Conversation deleted");
  };

  return {
    conversations,
    conversationsError: formatQueryError(conversationsQuery.error),
    retryConversations: () => {
      void conversationsQuery.refetch();
    },
    isConversationsFetching: conversationsQuery.isFetching,
    setConversations: (updater: React.SetStateAction<ConversationDTO[]>) => {
      queryClient.setQueryData<ConversationDTO[]>(
        queryKeys.messaging.conversations,
        (prev) => {
          const current = prev ?? [];
          return typeof updater === "function" ? updater(current) : updater;
        },
      );
    },
    selectedConvId,
    setSelectedConvId,
    selectedConversation,
    messages,
    currentUserId,
    isLoading: !initialized || conversationsQuery.isLoading,
    isMessagesLoading: messagesQuery.isLoading,
    refreshConversations,
    handleSendMessage,
    handleConversationCreated,
    handleDeleteConversation,
  };
}

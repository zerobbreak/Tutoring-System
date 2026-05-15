import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import * as z from "zod";
import { ConversationSidebar } from "#/components/messaging/ConversationSidebar";
import { ChatWindow } from "#/components/messaging/ChatWindow";
import { NewConversationDialog } from "#/components/messaging/NewConversationDialog";
import {
  getConversationMessagesFn,
  listConversationsFn,
  markConversationAsReadFn,
  sendMessageFn,
  type ConversationDTO,
  type MessageDTO,
} from "#/server-actions/messaging";
import { supabase } from "#/lib/supabase";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";

const messagesSearchSchema = z.object({
  conversation: z.string().uuid().optional(),
});

export const Route = createFileRoute("/lecturer/messages")({
  validateSearch: messagesSearchSchema,
  component: LecturerMessagesPage,
});

function LecturerMessagesPage() {
  const search = Route.useSearch();
  const [conversations, setConversations] = React.useState<ConversationDTO[]>([]);
  const [selectedConvId, setSelectedConvId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<MessageDTO[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  React.useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const convs = await listConversationsFn({ data: {} });
        setConversations(convs);

        if (search.conversation) {
          setSelectedConvId(search.conversation);
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
  }, [search.conversation]);

  React.useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    async function fetchMessages() {
      setIsMessagesLoading(true);
      try {
        const msgs = await getConversationMessagesFn({
          data: { conversationId: selectedConvId },
        });
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

  const handleSendMessage = async (content: string) => {
    if (!selectedConvId) return;
    try {
      await sendMessageFn({ data: { conversationId: selectedConvId, content } });
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
    }
  };

  const handleConversationCreated = (id: string) => {
    void listConversationsFn({ data: {} }).then(setConversations);
    setSelectedConvId(id);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full">
        <div className="w-80 space-y-4 border-r p-4">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <Skeleton className="h-16 w-full border-b" />
          <div className="flex-1 p-6">
            <Skeleton className="h-20 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <ConversationSidebar
        conversations={conversations}
        selectedId={selectedConvId}
        onSelect={setSelectedConvId}
        onCreateNew={() => setIsNewChatOpen(true)}
      />

      {selectedConversation && currentUserId ? (
        <ChatWindow
          conversation={selectedConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          currentUserId={currentUserId}
          isLoading={isMessagesLoading}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-12 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Select a conversation</h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Message tutors on your modules or start a new conversation.
          </p>
          <Button
            className="mt-6 gap-2 rounded-full px-6"
            onClick={() => setIsNewChatOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        </div>
      )}

      <NewConversationDialog
        open={isNewChatOpen}
        onOpenChange={setIsNewChatOpen}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}

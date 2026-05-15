import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { ConversationSidebar } from "#/components/messaging/ConversationSidebar";
import { ChatWindow } from "#/components/messaging/ChatWindow";
import { 
  listConversationsFn, 
  getConversationMessagesFn, 
  sendMessageFn, 
  markConversationAsReadFn,
  type ConversationDTO,
  type MessageDTO
} from "#/server-actions/messaging";
import { supabase } from "#/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "#/components/ui/skeleton";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "#/components/ui/button";
import { NewConversationDialog } from "#/components/messaging/NewConversationDialog";

export const Route = createFileRoute("/tutor/messaging")({
  component: MessagingPage,
});

function MessagingPage() {
  const [conversations, setConversations] = React.useState<ConversationDTO[]>([]);
  const [selectedConvId, setSelectedConvId] = React.useState<string | undefined>();
  const [messages, setMessages] = React.useState<MessageDTO[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);

  const selectedConversation = conversations.find(c => c.id === selectedConvId);

  // 1. Initial Load: Auth & Conversations
  React.useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const convs = await listConversationsFn({ data: {} });
        setConversations(convs);
        
        // Auto-select first conversation if exists
        if (convs.length > 0) {
          setSelectedConvId(convs[0].id);
        }
      } catch (err) {
        console.error("Failed to init messaging:", err);
        toast.error("Failed to load conversations");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // 2. Fetch messages when conversation changes
  React.useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    async function fetchMessages() {
      setIsMessagesLoading(true);
      try {
        const msgs = await getConversationMessagesFn({ data: { conversationId: selectedConvId } });
        setMessages(msgs);
        
        // Mark as read
        await markConversationAsReadFn({ data: { conversationId: selectedConvId } });
        
        // Update local unread count
        setConversations(prev => prev.map(c => 
          c.id === selectedConvId ? { ...c, unread_count: 0 } : c
        ));
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        toast.error("Failed to load message history");
      } finally {
        setIsMessagesLoading(false);
      }
    }
    fetchMessages();
  }, [selectedConvId]);

  // 3. Realtime Subscription
  React.useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // If message is for currently selected conversation
          if (newMsg.conversation_id === selectedConvId) {
            // Fetch sender info (or we could rely on a better payload if using a custom trigger)
            // For now, we'll just push it and refresh the list
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, {
                ...newMsg,
                sender_name: newMsg.sender_id === currentUserId ? 'Me' : 'Someone', // Simplified
              }];
            });

            // Mark as read immediately if it's the active window
            await markConversationAsReadFn({ data: { conversationId: selectedConvId } });
          }

          // Update conversation list order and unread counts
          setConversations(prev => {
            const index = prev.findIndex(c => c.id === newMsg.conversation_id);
            if (index === -1) {
              // Might be a new conversation started by someone else
              // In a real app, we'd trigger a full list refresh or have a separate subscription for conversations
              return prev;
            }
            
            const updated = [...prev];
            const conv = updated[index];
            
            updated[index] = {
              ...conv,
              updated_at: newMsg.created_at,
              last_message: {
                id: newMsg.id,
                conversation_id: newMsg.conversation_id,
                content: newMsg.content,
                sender_id: newMsg.sender_id,
                sender_name: newMsg.sender_id === currentUserId ? 'Me' : 'Someone',
                parent_message_id: newMsg.parent_message_id || null,
                metadata: newMsg.metadata || {},
                created_at: newMsg.created_at,
              },
              unread_count: newMsg.conversation_id === selectedConvId ? 0 : conv.unread_count + 1
            };
            
            // Move to top
            const item = updated.splice(index, 1)[0];
            updated.unshift(item);
            
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, currentUserId]);

  const handleSendMessage = async (content: string) => {
    if (!selectedConvId) return;
    
    try {
      await sendMessageFn({ data: { conversationId: selectedConvId, content } });
      // The realtime subscription will handle updating the UI
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message");
    }
  };

  const handleConversationCreated = (id: string) => {
    // Refresh conversations and select the new one
    listConversationsFn({ data: {} }).then(setConversations);
    setSelectedConvId(id);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full">
        <div className="w-80 border-r p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-16 border-b px-6 flex items-center">
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-20 w-1/2" />
            <Skeleton className="h-20 w-1/3 ml-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
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
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-muted/5">
          <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Select a conversation</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Choose a discussion from the sidebar or start a new one to start collaborating with lecturers and admins.
          </p>
          <Button 
            className="mt-6 gap-2 rounded-full px-6"
            onClick={() => setIsNewChatOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Conversation
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

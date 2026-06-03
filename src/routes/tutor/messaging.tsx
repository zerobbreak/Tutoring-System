import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { ConversationSidebar } from "#/components/messaging/ConversationSidebar";
import { ChatWindow } from "#/components/messaging/ChatWindow";
import { NewConversationDialog } from "#/components/messaging/NewConversationDialog";
import { useMessagingPage } from "#/components/messaging/use-messaging-page";
import { getOrCreatePeerConversationFn } from "#/server-actions/messaging";
import { Button } from "#/components/ui/button";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import { Skeleton } from "#/components/ui/skeleton";
import { MessageSquare, Plus } from "lucide-react";

export const Route = createFileRoute("/tutor/messaging")({
  component: MessagingPage,
});

function MessagingPage() {
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);

  const {
    conversations,
    setConversations,
    selectedConvId,
    setSelectedConvId,
    selectedConversation,
    messages,
    currentUserId,
    isLoading,
    conversationsError,
    retryConversations,
    isConversationsFetching,
    isMessagesLoading,
    handleSendMessage,
    handleConversationCreated,
    handleDeleteConversation,
  } = useMessagingPage();

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
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {conversationsError ? (
        <QueryErrorBanner
          message={conversationsError}
          onRetry={retryConversations}
          retrying={isConversationsFetching}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
          onPinChange={(pinned) => {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === selectedConversation.id
                  ? { ...c, my_is_pinned: pinned }
                  : c,
              ),
            );
          }}
          onDelete={() => void handleDeleteConversation()}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-12 text-center">
          <MessageSquare className="mb-6 h-10 w-10 text-muted-foreground/30" />
          <h2 className="text-2xl font-bold tracking-tight">Select a conversation</h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Choose a discussion from the sidebar or start a new one.
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
        onSelectUser={async (user) => {
          const { conversationId } = await getOrCreatePeerConversationFn({
            data: { peerUserId: user.id },
          });
          return conversationId;
        }}
        onConversationCreated={(id) => void handleConversationCreated(id)}
      />
      </div>
    </div>
  );
}

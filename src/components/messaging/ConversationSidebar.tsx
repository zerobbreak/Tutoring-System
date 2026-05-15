import * as React from "react";
import {
  Search,
  Plus,
  Pin,
  MessageSquare,
  Users,
  FileText,
  AlertCircle,
  Bookmark,
} from "lucide-react";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { cn } from "#/lib/utils";
import type { ConversationDTO } from "#/server-actions/messaging";
import { formatDistanceToNow } from "date-fns";

interface ConversationSidebarProps {
  conversations: ConversationDTO[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateNew?: () => void;
  isLoading?: boolean;
}

const CATEGORIES = [
  { id: "ALL", label: "All", icon: MessageSquare },
  { id: "DIRECT", label: "Direct", icon: Users },
  { id: "SESSION", label: "Sessions", icon: Bookmark },
  { id: "CLAIM", label: "Claims", icon: FileText },
  { id: "ATTENDANCE", label: "Attendance", icon: AlertCircle },
];

export function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  onCreateNew,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("ALL");

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.last_message?.content
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "ALL" || conv.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const pinnedConversations = filteredConversations.filter((c) =>
    c.participants.some((p) => p.is_pinned),
  );
  const recentConversations = filteredConversations.filter(
    (c) => !c.participants.some((p) => p.is_pinned),
  );

  return (
    <div className="flex flex-col h-full bg-card border-r w-80 shrink-0">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Messages</h2>
          <Button size="icon" variant="ghost" onClick={onCreateNew}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 bg-muted/50 border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "secondary" : "ghost"}
                size="sm"
                className="whitespace-nowrap h-8 px-2.5"
                onClick={() => setActiveCategory(cat.id)}
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {cat.label}
              </Button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 space-y-4 pb-4">
          {pinnedConversations.length > 0 && (
            <div>
              <div className="px-2 mb-2 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Pin className="h-3 w-3" /> PINNED
              </div>
              <div className="space-y-0.5">
                {pinnedConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedId === conv.id}
                    onClick={() => onSelect(conv.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            {pinnedConversations.length > 0 && (
              <div className="px-2 mb-2 text-xs font-semibold text-muted-foreground">
                RECENT
              </div>
            )}
            <div className="space-y-0.5">
              {recentConversations.length > 0 ? (
                recentConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedId === conv.id}
                    onClick={() => onSelect(conv.id)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No conversations found
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: ConversationDTO;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lastMsg = conversation.last_message;
  const otherParticipant = conversation.participants[0]; // Simplified for now

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left group",
        isSelected ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {conversation.title?.[0] || otherParticipant?.full_name[0] || "?"}
          </AvatarFallback>
        </Avatar>
        {conversation.unread_count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {conversation.unread_count}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-semibold truncate">
            {conversation.title ||
              otherParticipant?.full_name ||
              "New Conversation"}
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
            {conversation.updated_at &&
              formatDistanceToNow(new Date(conversation.updated_at), {
                addSuffix: false,
              })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {lastMsg ? (
            <>
              <span className="text-foreground/70 font-medium">
                {lastMsg.sender_name}:{" "}
              </span>
              {lastMsg.content}
            </>
          ) : (
            "No messages yet"
          )}
        </p>
      </div>
    </button>
  );
}

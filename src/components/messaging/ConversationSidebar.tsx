import * as React from "react";
import {
  Search,
  Plus,
  Pin,
  MessageSquare,
  Users,
  AlertCircle,
  Bookmark,
  Megaphone,
  Scale,
} from "lucide-react";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { cn } from "#/lib/utils";
import {
  conversationTopicLabel,
  MESSAGING_UI_CATEGORIES,
  searchMessagesFn,
  uiCategoryMatchesConversation,
  type AdminMessagingUiCategoryId,
  type ConversationDTO,
  type MessageSearchResultDTO,
  type MessagingUiCategoryId,
} from "#/server-actions/messaging";
import { formatDistanceToNow } from "date-fns";

type SidebarCategory = {
  id: string;
  label: string;
};

type CategoryMatcher = (
  categoryId: string,
  conv: { type: ConversationDTO["type"]; metadata: ConversationDTO["metadata"] },
) => boolean;

interface ConversationSidebarProps {
  conversations: ConversationDTO[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateNew?: () => void;
  isLoading?: boolean;
  title?: string;
  categories?: readonly SidebarCategory[];
  categoryMatcher?: CategoryMatcher;
  categoryIconSet?: "lecturer" | "admin";
}

const LECTURER_CATEGORY_ICONS: Record<MessagingUiCategoryId, React.ElementType> = {
  ALL: MessageSquare,
  TUTOR: Users,
  SESSION: Bookmark,
  ATTENDANCE: AlertCircle,
  ADMIN: Megaphone,
  DISPUTE: Scale,
};

const ADMIN_CATEGORY_ICONS: Record<AdminMessagingUiCategoryId, React.ElementType> = {
  ALL: MessageSquare,
  SYSTEM: Megaphone,
  ACADEMIC: Bookmark,
  PAYROLL: Users,
  ANNOUNCEMENT: Megaphone,
  DISPUTE: Scale,
};

export function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  onCreateNew,
  title = "Messages",
  categories = MESSAGING_UI_CATEGORIES,
  categoryMatcher,
  categoryIconSet = "lecturer",
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState(categories[0]!.id);

  const matchesCategory =
    categoryMatcher ??
    ((catId: string, conv: ConversationDTO) =>
      uiCategoryMatchesConversation(catId as MessagingUiCategoryId, conv));
  const [searchResults, setSearchResults] = React.useState<
    MessageSearchResultDTO[]
  >([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchMessagesFn({ data: { query: q, limit: 20 } });
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredConversations = conversations.filter((conv) => {
    if (!matchesCategory(activeCategory, conv)) return false;
    if (!searchQuery.trim() || searchResults.length > 0) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.title?.toLowerCase().includes(q) ||
      conv.last_message?.content.toLowerCase().includes(q)
    );
  });

  const pinnedConversations = filteredConversations.filter((c) => c.my_is_pinned);
  const recentConversations = filteredConversations.filter((c) => !c.my_is_pinned);

  const showMessageSearch = searchQuery.trim().length >= 2;

  return (
    <div className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-r bg-card">
      <div className="shrink-0 space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <Button size="icon" variant="ghost" onClick={onCreateNew}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            className="border-none bg-muted/50 pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {categories.map((cat) => {
            const Icon =
              categoryIconSet === "admin"
                ? ADMIN_CATEGORY_ICONS[cat.id as AdminMessagingUiCategoryId]
                : LECTURER_CATEGORY_ICONS[cat.id as MessagingUiCategoryId];
            return (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "secondary" : "ghost"}
                size="sm"
                className="h-8 shrink-0 whitespace-nowrap px-2.5"
                onClick={() => setActiveCategory(cat.id)}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {cat.label}
              </Button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-2 pb-4">
          {showMessageSearch ? (
            <div>
              <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
                {searching ? "Searching…" : `Message matches (${searchResults.length})`}
              </div>
              <div className="space-y-0.5">
                {searchResults.length === 0 && !searching ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No messages found
                  </p>
                ) : (
                  searchResults.map((hit) => (
                    <button
                      key={hit.message_id}
                      type="button"
                      onClick={() => onSelect(hit.conversation_id)}
                      className={cn(
                        "w-full rounded-lg p-3 text-left text-sm transition-colors hover:bg-accent/50",
                        selectedId === hit.conversation_id && "bg-accent",
                      )}
                    >
                      <p className="line-clamp-2 text-muted-foreground">{hit.content}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {!showMessageSearch && pinnedConversations.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground">
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
          ) : null}

          {!showMessageSearch ? (
            <div>
              {pinnedConversations.length > 0 ? (
                <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
                  RECENT
                </div>
              ) : null}
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
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No conversations found
                  </div>
                )}
              </div>
            </div>
          ) : null}
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
  const otherParticipant = conversation.participants.find(
    (p) => p.user_id !== conversation.participants[0]?.user_id,
  ) ?? conversation.participants[0];
  const topicLabel = conversationTopicLabel(
    conversation.type,
    conversation.metadata,
  );
  const displayTitle =
    conversation.title || otherParticipant?.full_name || "New conversation";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors",
        isSelected ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {conversation.title?.[0] || otherParticipant?.full_name[0] || "?"}
          </AvatarFallback>
        </Avatar>
        {conversation.unread_count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="truncate font-semibold">{displayTitle}</span>
          <span className="ml-2 whitespace-nowrap text-[10px] text-muted-foreground">
            {conversation.updated_at &&
              formatDistanceToNow(new Date(conversation.updated_at), {
                addSuffix: false,
              })}
          </span>
        </div>
        {topicLabel ? (
          <p className="mb-0.5 line-clamp-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {topicLabel}
          </p>
        ) : null}
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {lastMsg ? (
            <>
              <span className="font-medium text-foreground/70">
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

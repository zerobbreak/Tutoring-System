import * as React from "react";
import { Search, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { searchUsersFn } from "#/server-actions/messaging";
import { toast } from "sonner";

export type NewConversationUser = {
  id: string;
  full_name: string;
  email: string;
  role?: string;
};

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
  title?: string;
  description?: string;
  searchUsers?: (query: string) => Promise<NewConversationUser[]>;
  onSelectUser?: (user: NewConversationUser) => Promise<string>;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
  title = "New Message",
  description = "Search for a lecturer, admin, or tutor to start a conversation.",
  searchUsers,
  onSelectUser,
}: NewConversationDialogProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<NewConversationUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const users = searchUsers
          ? await searchUsers(query)
          : ((await searchUsersFn({ data: { query } })) as NewConversationUser[]);
        setResults(users);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  const handleCreate = async (targetUser: NewConversationUser) => {
    setIsCreating(true);
    try {
      let conversationId: string;
      if (!onSelectUser) {
        throw new Error("Conversation handler not configured.");
      }
      conversationId = await onSelectUser(targetUser);
      toast.success(`Opened conversation with ${targetUser.full_name}`);
      onConversationCreated(conversationId);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create conversation:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to start conversation",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[425px]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="p-6 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="h-[300px] border-t">
          <div className="p-2">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-1">
                {results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => void handleCreate(user)}
                    disabled={isCreating}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 font-bold text-primary">
                        {user.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {user.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.role ? `${user.role} · ` : ""}
                        {user.email}
                      </p>
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                <p className="text-sm">No users found matching &quot;{query}&quot;</p>
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center px-6 text-center text-muted-foreground">
                <p className="text-sm">Type a name to search</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

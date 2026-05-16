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
import {
  searchUsersFn,
  createConversationFn,
  buildMetadata,
  METADATA_CATEGORY,
} from "#/server-actions/messaging";
import { toast } from "sonner";
interface User {
  id: string;
  full_name: string;
  email: string;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const users = await searchUsersFn({ data: { query } });
        setResults(users as User[]);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleCreate = async (targetUser: User) => {
    setIsCreating(true);
    try {
      const conv = await createConversationFn({
        data: {
          type: "DIRECT",
          participants: [targetUser.id],
          metadata: buildMetadata(METADATA_CATEGORY.TUTOR_DISCUSSION, {
            tutor_id: targetUser.id,
          }),
        },
      });
      toast.success(`Conversation with ${targetUser.full_name} started`);
      onConversationCreated(conv.id);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create conversation:", err);
      toast.error("Failed to start conversation");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Search for a lecturer, admin, or tutor to start a conversation.
          </DialogDescription>
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
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-1">
                {results.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleCreate(user)}
                    disabled={isCreating}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {user.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">No users found matching "{query}"</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center px-6">
                <p className="text-sm">Type a name to search</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

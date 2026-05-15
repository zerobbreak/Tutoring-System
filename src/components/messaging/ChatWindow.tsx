import * as React from "react";
import {
  Send,
  MoreVertical,
  Paperclip,
  MessageSquare,
  Pin,
  PinOff,
  FileIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { cn } from "#/lib/utils";
import { togglePinConversationFn } from "#/server-actions/messaging";
import type { MessageDTO, ConversationDTO } from "#/server-actions/messaging";
import { format } from "date-fns";
import { toast } from "sonner";

type PendingAttachment = {
  fileName: string;
  mimeType: string;
  fileBase64: string;
};

interface ChatWindowProps {
  conversation: ConversationDTO;
  messages: MessageDTO[];
  onSendMessage: (
    content: string,
    attachments?: PendingAttachment[],
  ) => void | Promise<void>;
  onPinChange?: (pinned: boolean) => void;
  isLoading?: boolean;
  currentUserId: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  onPinChange,
  currentUserId,
  isLoading,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [pendingFiles, setPendingFiles] = React.useState<PendingAttachment[]>([]);
  const [pinning, setPinning] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text && pendingFiles.length === 0) return;
    await onSendMessage(text || "(attachment)", pendingFiles);
    setInputValue("");
    setPendingFiles([]);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    try {
      const next: PendingAttachment[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 25MB limit`);
          continue;
        }
        next.push({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileBase64: await readFileAsBase64(file),
        });
      }
      setPendingFiles((prev) => [...prev, ...next].slice(0, 5));
    } catch {
      toast.error("Could not read file");
    }
    e.target.value = "";
  };

  const handleTogglePin = async () => {
    setPinning(true);
    try {
      const result = await togglePinConversationFn({
        data: { conversationId: conversation.id },
      });
      onPinChange?.(result.is_pinned);
      toast.success(result.is_pinned ? "Conversation pinned" : "Unpinned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update pin");
    } finally {
      setPinning(false);
    }
  };

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const otherParticipant =
    conversation.participants.find((p) => p.user_id !== currentUserId) ||
    conversation.participants[0];

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-card/50 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">
              {conversation.title?.[0] || otherParticipant?.full_name[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="mb-1 text-sm font-semibold leading-none">
              {conversation.title ||
                otherParticipant?.full_name ||
                "Conversation"}
            </h3>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {conversation.type.replace("_", " ")}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={pinning} onClick={() => void handleTogglePin()}>
              {conversation.my_is_pinned ? (
                <>
                  <PinOff className="mr-2 h-4 w-4" /> Unpin
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-4 w-4" /> Pin conversation
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 px-6" viewportRef={scrollRef}>
        <div className="space-y-6 py-6">
          {isLoading ? (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Loading messages…
            </p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageSquare className="mb-4 h-8 w-8 text-muted-foreground/50" />
              <h4 className="font-medium text-muted-foreground">No messages yet</h4>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUserId;
              const prevMsg = messages[index - 1];
              const showDate =
                !prevMsg ||
                format(new Date(msg.created_at), "yyyy-MM-dd") !==
                  format(new Date(prevMsg.created_at), "yyyy-MM-dd");

              return (
                <React.Fragment key={msg.id}>
                  {showDate ? (
                    <div className="my-8 flex justify-center">
                      <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {format(new Date(msg.created_at), "EEEE, MMMM d")}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className={cn("flex group", isMe ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "flex max-w-[75%] flex-col gap-1",
                        isMe ? "items-end" : "items-start",
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          isMe
                            ? "rounded-tr-none bg-primary text-primary-foreground"
                            : "rounded-tl-none bg-muted text-foreground",
                        )}
                      >
                        {msg.content}
                      </div>
                      {msg.attachments.length > 0 ? (
                        <ul className="space-y-1">
                          {msg.attachments.map((att) => (
                            <li
                              key={att.id}
                              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs"
                            >
                              <FileIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{att.file_name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <span className="px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 p-6 pt-2">
        {pendingFiles.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <li
                key={`${f.fileName}-${i}`}
                className="rounded-md border bg-muted px-2 py-1 text-xs"
              >
                {f.fileName}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="relative rounded-2xl border bg-card p-1 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => void handleFilePick(e)}
          />
          <div className="flex items-end gap-1 px-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Type a message..."
              className="min-h-[40px] border-none bg-transparent px-2 text-sm focus-visible:ring-0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0 bg-primary text-primary-foreground"
              disabled={!inputValue.trim() && pendingFiles.length === 0}
              onClick={() => void handleSend()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

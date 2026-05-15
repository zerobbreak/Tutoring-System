import * as React from "react";
import {
  Send,
  MoreVertical,
  Phone,
  Video,
  Info,
  Paperclip,
  Smile,
  MessageSquare,
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
import type { MessageDTO, ConversationDTO } from "#/server-actions/messaging";
import { format } from "date-fns";

interface ChatWindowProps {
  conversation: ConversationDTO;
  messages: MessageDTO[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  currentUserId: string;
}

export function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  currentUserId,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue("");
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
    <div className="flex flex-col h-full bg-background flex-1">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">
              {conversation.title?.[0] || otherParticipant?.full_name[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm leading-none mb-1">
              {conversation.title ||
                otherParticipant?.full_name ||
                "Conversation"}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                Online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Video className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Info className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Pin Conversation</DropdownMenuItem>
              <DropdownMenuItem>Mute Notifications</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Delete History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6" viewportRef={scrollRef}>
        <div className="py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h4 className="font-medium text-muted-foreground">
                No messages yet
              </h4>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start the conversation by typing below
              </p>
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
                  {showDate && (
                    <div className="flex justify-center my-8">
                      <span className="px-3 py-1 rounded-full bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {format(new Date(msg.created_at), "EEEE, MMMM d")}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex group",
                      isMe ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "flex gap-3 max-w-[75%]",
                        isMe ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      {!isMe && (
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                          <AvatarFallback className="text-[10px] bg-secondary">
                            {msg.sender_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "flex flex-col gap-1",
                          isMe ? "items-end" : "items-start",
                        )}
                      >
                        {!isMe && (
                          <span className="text-[10px] font-semibold text-muted-foreground ml-1">
                            {msg.sender_name}
                          </span>
                        )}
                        <div
                          className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "bg-muted text-foreground rounded-tl-none",
                          )}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-6 pt-2 shrink-0">
        <div className="relative bg-card border rounded-2xl p-1 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <div className="flex items-end gap-1 px-2 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Type a message..."
              className="border-none bg-transparent focus-visible:ring-0 min-h-[40px] px-2 text-sm"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
            >
              <Smile className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className={cn(
                "h-9 w-9 shrink-0 transition-transform active:scale-95",
                inputValue.trim()
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              disabled={!inputValue.trim()}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center px-10">
          Your messages are encrypted and securely stored. Attachments are
          limited to 25MB.
        </p>
      </div>
    </div>
  );
}

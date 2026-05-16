import { Link } from "@tanstack/react-router";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import type { ConversationDTO } from "#/server-actions/messaging";

type DashboardRecentMessagesProps = {
  booting: boolean;
  conversations: ConversationDTO[];
};

export function DashboardRecentMessages({
  booting,
  conversations,
}: DashboardRecentMessagesProps) {
  const preview = conversations.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">Recent messages</CardTitle>
          <CardDescription>Latest conversations across your institution</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link to="/tutor/messaging">Open messaging</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {booting ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : preview.length === 0 ? (
          <p className="text-muted-foreground">No conversations yet.</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((conv) => {
              const participantNames = conv.participants
                .map((p) => p.full_name)
                .filter(Boolean)
                .join(", ");
              const title = conv.title ?? (participantNames || "Conversation");
              const last = conv.last_message?.content ?? "No messages yet";

              return (
                <li
                  key={conv.id}
                  className="flex gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <MessageSquare
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/tutor/messaging"
                      className="font-medium text-foreground hover:underline"
                    >
                      {title}
                    </Link>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{last}</p>
                  </div>
                  {conv.unread_count > 0 ? (
                    <span className="shrink-0 rounded-full bg-[var(--lagoon)] px-2 py-0.5 text-xs font-medium text-white">
                      {conv.unread_count}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

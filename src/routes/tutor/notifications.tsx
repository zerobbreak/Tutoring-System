import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { NotificationsInboxView } from "#/components/notifications/notifications-inbox-view";
import { Card, CardContent } from "#/components/ui/card";
import { ScrollArea } from "#/components/ui/scroll-area";
import { APP_PATHS } from "#/lib/app-paths";

export const Route = createFileRoute("/tutor/notifications")({
  component: TutorNotificationsPage,
});

function TutorNotificationsPage() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex w-full min-w-0 flex-col gap-6 p-6 pb-10 md:p-8">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Bell className="size-7 text-(--lagoon-deep)" aria-hidden />
            Notifications
          </h2>
          <p className="text-sm text-muted-foreground">
            Schedule changes, claim updates, and reminders for your teaching
            sessions.
          </p>
        </header>

        <Card className="w-full min-w-0">
          <CardContent className="p-4 sm:p-6 md:p-8">
            <NotificationsInboxView
              sessionsLink={APP_PATHS.tutor.sessions}
              limit={100}
            />
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

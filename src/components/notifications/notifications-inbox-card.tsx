import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { NotificationsInboxView } from "#/components/notifications/notifications-inbox-view";
import { DASHBOARD_PANEL_LIST_MIN_H } from "#/components/tutor/dashboard/dashboard-panel-card";
import { cn } from "#/lib/utils";

type NotificationsInboxCardProps = {
  sessionsLink?: string;
  title?: string;
  description?: string;
  /** When set, hides filters and caps the list (dashboard preview). */
  previewLimit?: number;
  moreHref?: string;
};

export function NotificationsInboxCard({
  sessionsLink = "/tutor/sessions",
  title = "Notifications",
  description = "Schedule changes, approvals, and reminders",
  previewLimit,
  moreHref = "/tutor/notifications",
}: NotificationsInboxCardProps) {
  const isPreview = previewLimit != null && previewLimit > 0;

  return (
    <Card className={cn(isPreview && "flex h-full flex-col")}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {isPreview ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link to={moreHref}>More</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0",
          isPreview && "flex flex-1 flex-col gap-2",
        )}
      >
        <div className={isPreview ? DASHBOARD_PANEL_LIST_MIN_H : undefined}>
          <NotificationsInboxView
            sessionsLink={sessionsLink}
            previewLimit={previewLimit}
            className={isPreview ? "space-y-0" : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}

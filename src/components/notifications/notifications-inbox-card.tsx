import { Link } from "@tanstack/react-router";
import { Bell, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationCategory,
} from "#/lib/notification-category";
import { toast } from "#/lib/toast";
import { DASHBOARD_PANEL_LIST_MIN_H } from "#/components/tutor/dashboard/dashboard-panel-card";
import { cn } from "#/lib/utils";
import {
  listNotificationsForUserFn,
  markAllNotificationsReadFn,
  markNotificationReadFn,
  type NotificationRowDTO,
} from "#/server-actions/notifications";

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
  const fetchLimit = isPreview ? previewLimit : 40;
  const [rows, setRows] = useState<NotificationRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotificationsForUserFn({
        data: { limit: fetchLimit },
      });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [fetchLimit]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = isPreview
    ? rows
    : filter === "all"
      ? rows
      : rows.filter((r) => r.category === filter);
  const displayRows = isPreview ? filtered.slice(0, previewLimit) : filtered;
  const hasMore = isPreview && rows.length > previewLimit;

  const unreadCount = rows.filter((r) => !r.is_read).length;

  async function handleMarkRead(n: NotificationRowDTO) {
    if (n.is_read) return;
    try {
      await markNotificationReadFn({ data: { notificationId: n.id } });
      setRows((prev) =>
        prev.map((r) =>
          r.id === n.id ? { ...r, is_read: true, read_at: new Date().toISOString() } : r,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark as read");
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsReadFn();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark all as read");
    }
  }

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
        ) : unreadCount > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleMarkAllRead()}>
            Mark all read
          </Button>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          "pt-0 text-sm",
          isPreview ? "flex flex-1 flex-col gap-2" : "space-y-3",
        )}
      >
        {!isPreview ? (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            {(Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[]).map(
              (cat) => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={filter === cat ? "default" : "outline"}
                  onClick={() => setFilter(cat)}
                >
                  {NOTIFICATION_CATEGORY_LABELS[cat]}
                </Button>
              ),
            )}
          </div>
        ) : null}

        <div className={isPreview ? DASHBOARD_PANEL_LIST_MIN_H : undefined}>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : displayRows.length === 0 ? (
          <p className="text-muted-foreground">
            {isPreview ? "No notifications yet." : "No notifications in this category."}
          </p>
        ) : (
          <ul className="space-y-2">
            {displayRows.map((n) =>
              isPreview ? (
                <li
                  key={n.id}
                  className="flex gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <Bell
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {n.subject || n.type.replace(/_/g, " ")}
                    </p>
                    {n.body ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.sent_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  {!n.is_read ? (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-(--lagoon-deep)" />
                  ) : null}
                </li>
              ) : (
                <li key={n.id}>
                  <button
                    type="button"
                    className="flex w-full gap-2 rounded-lg border border-border/60 p-2 text-left transition-colors hover:bg-muted/40"
                    onClick={() => void handleMarkRead(n)}
                  >
                    <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">
                          {n.subject || n.type.replace(/_/g, " ")}
                        </p>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {NOTIFICATION_CATEGORY_LABELS[n.category]}
                        </Badge>
                        {!n.is_read ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Unread
                          </Badge>
                        ) : null}
                      </div>
                      {n.body ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(n.sent_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {n.claim_id ? (
                        <Link
                          to={sessionsLink}
                          search={{ claim: n.claim_id }}
                          className="mt-1 inline-block text-xs font-medium text-(--lagoon-deep) hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View session
                        </Link>
                      ) : null}
                    </div>
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
        </div>
        {!loading && hasMore ? (
          <p className="mt-auto text-xs text-muted-foreground">
            Showing {displayRows.length} of {rows.length} notifications.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

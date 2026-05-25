import { Link } from "@tanstack/react-router";
import { Bell, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationCategory,
} from "#/lib/notification-category";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import {
  listNotificationsForUserFn,
  markAllNotificationsReadFn,
  markNotificationReadFn,
  type NotificationRowDTO,
} from "#/server-actions/notifications";

export type NotificationsInboxViewProps = {
  sessionsLink?: string;
  /** Max rows to fetch from the server. */
  limit?: number;
  /** When set, renders compact rows and caps visible items (dashboard preview). */
  previewLimit?: number;
  className?: string;
};

export function NotificationsInboxView({
  sessionsLink = "/tutor/sessions",
  limit = 100,
  previewLimit,
  className,
}: NotificationsInboxViewProps) {
  const isPreview = previewLimit != null && previewLimit > 0;
  const fetchLimit = isPreview ? Math.max(previewLimit, 40) : limit;
  const [rows, setRows] = useState<NotificationRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotificationsForUserFn({
        data: { limit: fetchLimit },
      });
      setRows(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load notifications",
      );
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
  const displayRows = isPreview
    ? filtered.slice(0, previewLimit)
    : filtered;
  const hasMore = isPreview && rows.length > previewLimit;
  const unreadCount = rows.filter((r) => !r.is_read).length;

  async function handleMarkRead(n: NotificationRowDTO) {
    if (n.is_read) return;
    try {
      await markNotificationReadFn({ data: { notificationId: n.id } });
      setRows((prev) =>
        prev.map((r) =>
          r.id === n.id
            ? { ...r, is_read: true, read_at: new Date().toISOString() }
            : r,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark as read");
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsReadFn();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className={cn("space-y-4 text-sm", className)}>
      {!isPreview ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={markingAll}
              onClick={() => void handleMarkAllRead()}
            >
              {markingAll ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Mark all read
            </Button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading notifications…
        </div>
      ) : displayRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
          <Bell className="size-8 text-muted-foreground/50" aria-hidden />
          <p className="font-medium text-foreground">No notifications</p>
          <p className="max-w-sm text-muted-foreground">
            {isPreview
              ? "You are all caught up."
              : filter === "all"
                ? "Schedule changes, claim updates, and reminders will appear here."
                : "No notifications in this category."}
          </p>
        </div>
      ) : (
        <ul className={cn("space-y-2", !isPreview && "rounded-xl border border-border/80")}>
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
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {n.body}
                    </p>
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
              <li key={n.id} className="border-b border-border/60 last:border-0">
                <button
                  type="button"
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                    !n.is_read && "bg-lagoon/5",
                  )}
                  onClick={() => void handleMarkRead(n)}
                >
                  <Bell
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
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
                      <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.sent_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    {n.claim_id ? (
                      <Link
                        to={sessionsLink}
                        search={{ claim: n.claim_id }}
                        className="mt-2 inline-block text-xs font-medium text-(--lagoon-deep) hover:underline"
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

      {!loading && hasMore ? (
        <p className="text-xs text-muted-foreground">
          Showing {displayRows.length} of {rows.length} notifications.
        </p>
      ) : null}

      {!loading && !isPreview && displayRows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread · tap a notification to mark it read`
            : "All caught up — tap a notification to open details"}
        </p>
      ) : null}
    </div>
  );
}

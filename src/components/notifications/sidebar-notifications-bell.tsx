import { Link, useRouterState } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "#/lib/utils";
import { listNotificationsForUserFn } from "#/server-actions/notifications";

type SidebarNotificationsBellProps = {
  to: string;
  className?: string;
};

export function SidebarNotificationsBell({
  to,
  className,
}: SidebarNotificationsBellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(`${to}/`);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const rows = await listNotificationsForUserFn({ data: { limit: 40 } });
      setUnreadCount(rows.filter((r) => !r.is_read).length);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread, pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadUnread]);

  const badgeLabel =
    unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Link
      to={to}
      aria-label="Notifications"
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center text-sidebar-foreground transition-opacity",
        "hover:opacity-80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active && "text-(--lagoon-deep)",
        "group-data-[collapsible=icon]:size-8",
        className,
      )}
    >
      <Bell className="size-4" aria-hidden />
      {badgeLabel ? (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-(--lagoon-deep) px-1 text-[10px] font-semibold leading-none text-white">
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  );
}

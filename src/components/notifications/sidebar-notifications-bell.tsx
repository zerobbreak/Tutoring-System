import { Link, useRouterState } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "#/components/ui/sidebar";
import { cn } from "#/lib/utils";
import { listNotificationsForUserFn } from "#/server-actions/notifications";

type SidebarNotificationsBellProps = {
  to: string;
};

export function SidebarNotificationsBell({ to }: SidebarNotificationsBellProps) {
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
    <SidebarMenuItem className="w-auto shrink-0 group-data-[collapsible=icon]:w-full">
      <SidebarMenuButton
        asChild
        tooltip="Notifications"
        isActive={active}
        className="relative size-10 shrink-0 p-0 group-data-[collapsible=icon]:size-8"
      >
        <Link to={to} aria-label="Notifications">
          <Bell className="size-[1.125rem]" aria-hidden />
          {badgeLabel ? (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-(--lagoon-deep) px-1 text-[10px] font-semibold leading-none text-white",
                "group-data-[collapsible=icon]:-top-0.5 group-data-[collapsible=icon]:-right-0.5",
              )}
            >
              {badgeLabel}
            </span>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

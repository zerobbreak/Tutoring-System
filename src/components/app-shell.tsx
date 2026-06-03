import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, LifeBuoy, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "#/components/ui/sidebar";
import { APP_PATHS } from "#/lib/app-paths";
import { navItemActive } from "#/lib/nav-item-active";
import { supabase } from "#/lib/supabase";
import { SidebarNotificationsBell } from "#/components/notifications/sidebar-notifications-bell";
import { ThemeToggle } from "./theme-toggle";

export type AppShellNavItem = {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

export type AppShellNavGroup = {
  readonly label: string;
  readonly items: readonly AppShellNavItem[];
};

export type AppShellUser = {
  email?: string;
  user_metadata?: Record<string, string | undefined>;
};

function normalizePath(path: string) {
  return path === "/" ? path : path.replace(/\/+$/, "");
}

function flattenNav(navGroups: readonly AppShellNavGroup[]) {
  return navGroups.flatMap((g) => [...g.items]);
}

function pageTitleFromPath(
  pathname: string,
  homePath: string,
  navGroups: readonly AppShellNavGroup[],
  navPaths: readonly string[],
  helpPath?: string,
  notificationsPath?: string,
) {
  if (
    notificationsPath &&
    (normalizePath(pathname) === normalizePath(notificationsPath) ||
      normalizePath(pathname).startsWith(
        `${normalizePath(notificationsPath)}/`,
      ))
  ) {
    return "Notifications";
  }
  if (
    helpPath &&
    (normalizePath(pathname) === normalizePath(helpPath) ||
      normalizePath(pathname).startsWith(`${normalizePath(helpPath)}/`))
  ) {
    return "Get Help";
  }
  const hit = flattenNav(navGroups).find((n) =>
    navItemActive(pathname, n.to, homePath, navPaths),
  );
  return hit?.label ?? "Home";
}

function renderNavBlock(
  pathname: string,
  homePath: string,
  items: readonly AppShellNavItem[],
  navPaths: readonly string[],
) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = navItemActive(pathname, item.to, homePath, navPaths);
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
              <Link to={item.to}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppShell({
  homePath,
  brandMark,
  brandTitle,
  brandSubtitle,
  navGroups,
  user,
  fallbackDisplayName,
  children,
  headerTrailing,
  helpPath,
  settingsPath = APP_PATHS.settings,
  notificationsPath,
}: {
  homePath: string;
  brandMark: ReactNode;
  brandTitle: string;
  brandSubtitle: string;
  navGroups: readonly AppShellNavGroup[];
  user: AppShellUser;
  fallbackDisplayName: string;
  children: ReactNode;
  /** Omit for default “Quick create”; pass `null` to hide the header action slot. */
  headerTrailing?: ReactNode | null;
  /** When set, sidebar “Get Help” links here and the breadcrumb shows “Get Help”. */
  helpPath?: string;
  /** Sidebar settings link target (default `/settings`). */
  settingsPath?: string;
  /** When set, shows a bell control beside the profile menu in the sidebar footer. */
  notificationsPath?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navPaths = flattenNav(navGroups).map((item) => item.to);
  const title = pageTitleFromPath(
    pathname,
    homePath,
    navGroups,
    navPaths,
    helpPath,
    notificationsPath,
  );

  const initials = user.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : (user.email?.[0]?.toUpperCase() ?? "?");

  const displayName =
    user.user_metadata?.full_name ?? fallbackDisplayName;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = APP_PATHS.auth.login;
  };

  return (
    <SidebarProvider
      className="flex min-h-0 w-full flex-1 items-stretch"
      style={{ "--sidebar-width": "18.5rem" } as CSSProperties}
    >
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="shrink-0 border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip={brandTitle}>
                <Link to={homePath}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {brandMark}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold tracking-tight">
                      {brandTitle}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {brandSubtitle}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="flex-1 overflow-y-auto overscroll-contain">
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                {renderNavBlock(pathname, homePath, group.items, navPaths)}
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarGroup className="shrink-0 border-t border-sidebar-border">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Settings"
                  isActive={
                    normalizePath(pathname) === normalizePath(settingsPath) ||
                    normalizePath(pathname).startsWith(
                      `${normalizePath(settingsPath)}/`,
                    )
                  }
                >
                  <Link to={settingsPath}>
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {helpPath ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                  asChild
                  tooltip="Get Help"
                  isActive={
                      normalizePath(pathname) === normalizePath(helpPath) ||
                      normalizePath(pathname).startsWith(
                        `${normalizePath(helpPath)}/`,
                      )
                  }
                >
                    <Link to={helpPath}>
                      <LifeBuoy />
                      <span>Get Help</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter className="shrink-0 gap-0 border-t border-sidebar-border bg-sidebar p-0 px-2 pt-2 pb-0">
          <SidebarMenu>
            <SidebarMenuItem>
              {notificationsPath ? (
                <div className="flex min-h-12 w-full items-center gap-1.5 py-2 pb-0 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-1">
                  <div className="min-w-0 flex-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          size="lg"
                          tooltip={displayName}
                          className="h-auto min-h-0 w-full rounded-md py-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                          <Avatar className="size-8 rounded-lg">
                            {user.user_metadata?.avatar_url ? (
                              <AvatarImage
                                src={user.user_metadata.avatar_url}
                                alt={user.email ?? ""}
                              />
                            ) : (
                              <AvatarFallback className="rounded-lg text-xs font-medium">
                                {initials}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                              {displayName}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-56"
                        side="bottom"
                        align="end"
                        sideOffset={4}
                      >
                        <DropdownMenuItem asChild>
                          <Link to={settingsPath}>Settings</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={handleLogout}
                        >
                          Log out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <SidebarNotificationsBell to={notificationsPath} />
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      tooltip={displayName}
                      className="h-auto min-h-12 w-full rounded-b-none py-2 pb-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <Avatar className="size-8 rounded-lg">
                        {user.user_metadata?.avatar_url ? (
                          <AvatarImage
                            src={user.user_metadata.avatar_url}
                            alt={user.email ?? ""}
                          />
                        ) : (
                          <AvatarFallback className="rounded-lg text-xs font-medium">
                            {initials}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {displayName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-56"
                    side="bottom"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenuItem asChild>
                      <Link to={settingsPath}>Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleLogout}
                    >
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col bg-background md:m-0 md:rounded-none md:shadow-none">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
          <SidebarTrigger className="shrink-0" />
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted-foreground"
          >
            <Link to={homePath} className="truncate hover:text-foreground">
              Home
            </Link>
            <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
            <span className="truncate font-medium text-foreground">
              {title}
            </span>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {headerTrailing !== undefined ? (
              headerTrailing
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Quick create
              </Button>
            )}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

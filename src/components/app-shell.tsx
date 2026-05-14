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
} from "#/components/ui/sidebar";
import { supabase } from "#/lib/supabase";

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

function navItemActive(pathname: string, to: string, homePath: string) {
  if (to === homePath) {
    return pathname === homePath || pathname === `${homePath}/`;
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function flattenNav(navGroups: readonly AppShellNavGroup[]) {
  return navGroups.flatMap((g) => [...g.items]);
}

function pageTitleFromPath(
  pathname: string,
  homePath: string,
  navGroups: readonly AppShellNavGroup[],
) {
  const hit = flattenNav(navGroups).find((n) =>
    navItemActive(pathname, n.to, homePath),
  );
  return hit?.label ?? "Home";
}

function renderNavBlock(
  pathname: string,
  homePath: string,
  items: readonly AppShellNavItem[],
) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = navItemActive(pathname, item.to, homePath);
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={active}>
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
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = pageTitleFromPath(pathname, homePath, navGroups);

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
    window.location.href = "/auth/login";
  };

  return (
    <SidebarProvider
      className="flex min-h-0 w-full flex-1 items-stretch"
      style={{ "--sidebar-width": "18.5rem" } as CSSProperties}
    >
      <Sidebar
        collapsible="none"
        variant="sidebar"
        className="h-svh shrink-0 border-r border-sidebar-border bg-sidebar"
      >
        <SidebarHeader className="shrink-0 border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
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
                {renderNavBlock(pathname, homePath, group.items)}
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
                  isActive={
                    pathname === "/settings" ||
                    pathname.startsWith("/settings/")
                  }
                >
                  <Link to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#help">
                    <LifeBuoy />
                    <span>Get Help</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter className="shrink-0 gap-0 border-t border-sidebar-border bg-sidebar p-0 px-2 pt-2 pb-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="h-auto min-h-12 rounded-b-none py-2 pb-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
                    <Link to="/settings">Settings</Link>
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-background md:m-0 md:rounded-none md:shadow-none">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
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
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

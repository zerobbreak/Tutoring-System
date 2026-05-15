import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import {
  AppShell,
  type AppShellNavGroup,
  type AppShellUser,
} from "#/components/app-shell";
import { formatRoleLabel } from "#/lib/user-role";

const ADMIN_NAV_GROUPS: readonly AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
] as const;

export function AdminAppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: ReactNode;
}) {
  const role = user.user_metadata?.role as string | undefined;
  const fallbackDisplayName = formatRoleLabel(role);

  return (
    <AppShell
      homePath="/admin"
      brandMark={<span className="text-xs font-bold">EL</span>}
      brandTitle="Emeris Admin"
      brandSubtitle="Operations"
      navGroups={ADMIN_NAV_GROUPS}
      user={user}
      fallbackDisplayName={fallbackDisplayName}
      headerTrailing={null}
    >
      {children}
    </AppShell>
  );
}

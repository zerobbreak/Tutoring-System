import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquare,
  ScrollText,

  UserCheck,
  Users,
  Video,
} from "lucide-react";
import {
  AppShell,
  type AppShellNavGroup,
  type AppShellUser,
} from "#/components/app-shell";
import { formatRoleLabel } from "#/lib/user-role";

const ADMIN_NAV_GROUPS: readonly AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/approvals", label: "Approvals", icon: ClipboardCheck },
    ],
  },
  {
    label: "Organization",
    items: [
      { to: "/admin/institutions", label: "Institutions", icon: Building2 },
      { to: "/admin/users", label: "Users", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/schedules", label: "Schedules", icon: Calendar },
      { to: "/admin/sessions", label: "Sessions", icon: Video },
      { to: "/admin/payements", label: "Payment", icon: UserCheck },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/admin/messaging", label: "Messaging", icon: MessageSquare },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/reports", label: "Reports", icon: FileText },
      { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
    ],
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

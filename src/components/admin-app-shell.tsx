import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  ScrollText,

  Users,
  Video,
  Wallet,
} from "lucide-react";
import {
  AppShell,
  type AppShellNavGroup,
  type AppShellUser,
} from "#/components/app-shell";
import { APP_PATHS } from "#/lib/app-paths";
import { formatRoleLabel, getUserRole } from "#/lib/user-role";

const ADMIN_NAV_GROUPS: readonly AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: APP_PATHS.admin.home, label: "Dashboard", icon: LayoutDashboard },
      {
        to: APP_PATHS.admin.approvals,
        label: "Approvals",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Organization",
    items: [
      {
        to: APP_PATHS.admin.institutions,
        label: "Institutions",
        icon: Building2,
      },
      { to: APP_PATHS.admin.users, label: "Users", icon: Users },
      { to: APP_PATHS.admin.venues, label: "Venues", icon: MapPin },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: APP_PATHS.admin.schedules, label: "Schedules", icon: Calendar },
      { to: APP_PATHS.admin.sessions, label: "Sessions", icon: Video },
      { to: APP_PATHS.admin.payments, label: "Payroll", icon: Wallet },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        to: APP_PATHS.admin.messaging,
        label: "Messaging",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: APP_PATHS.admin.analytics, label: "Analytics", icon: BarChart3 },
      { to: APP_PATHS.admin.reports, label: "Reports", icon: FileText },
      {
        to: APP_PATHS.admin.auditLogs,
        label: "Audit Logs",
        icon: ScrollText,
      },
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
  const role = getUserRole(user);
  const fallbackDisplayName = formatRoleLabel(role);

  return (
    <AppShell
      homePath={APP_PATHS.admin.home}
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

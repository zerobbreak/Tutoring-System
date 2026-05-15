import type { ReactNode } from "react";
import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import {
  AppShell,
  type AppShellNavGroup,
  type AppShellUser,
} from "#/components/app-shell";

const LECTURER_NAV_GROUPS: readonly AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/lecturer", label: "Dashboard", icon: LayoutDashboard },
      {
        to: "/lecturer/verification-queue",
        label: "Verification Queue",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Teaching",
    items: [
      { to: "/lecturer/schedule", label: "Schedule", icon: Calendar },
      { to: "/lecturer/sessions", label: "Sessions", icon: Video },
      { to: "/lecturer/tutors", label: "Tutors", icon: Users },
      { to: "/lecturer/attendance", label: "Attendance", icon: UserCheck },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/lecturer/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/lecturer/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/lecturer/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/lecturer/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export function LecturerAppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: ReactNode;
}) {
  return (
    <AppShell
      homePath="/lecturer"
      settingsPath="/lecturer/settings"
      brandMark={<span className="text-xs font-bold">EL</span>}
      brandTitle="Lecturer Hub"
      brandSubtitle="Emeris Learning"
      navGroups={LECTURER_NAV_GROUPS}
      user={user}
      fallbackDisplayName="Lecturer"
      headerTrailing={null}
    >
      {children}
    </AppShell>
  );
}

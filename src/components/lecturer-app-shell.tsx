import type { ReactNode } from "react";
import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquare,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import {
  AppShell,
  type AppShellNavGroup,
  type AppShellUser,
} from "#/components/app-shell";
import { APP_PATHS } from "#/lib/app-paths";

const LECTURER_NAV_GROUPS: readonly AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: APP_PATHS.lecturer.home, label: "Dashboard", icon: LayoutDashboard },
      {
        to: APP_PATHS.lecturer.verificationQueue,
        label: "Verification Queue",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Teaching",
    items: [
      { to: APP_PATHS.lecturer.schedule, label: "Schedule", icon: Calendar },
      { to: APP_PATHS.lecturer.sessions, label: "Sessions", icon: Video },
      { to: APP_PATHS.lecturer.tutors, label: "Tutors", icon: Users },
      { to: APP_PATHS.lecturer.attendance, label: "Attendance", icon: UserCheck },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        to: APP_PATHS.lecturer.messages,
        label: "Messages",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: APP_PATHS.lecturer.analytics, label: "Analytics", icon: BarChart3 },
      { to: APP_PATHS.lecturer.reports, label: "Reports", icon: FileText },
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
      homePath={APP_PATHS.lecturer.home}
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

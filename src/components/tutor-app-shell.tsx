import type { ReactNode } from "react";
import {
  Calendar,
  ClipboardCheck,
  Coins,
  FileSpreadsheet,
  LayoutDashboard,
  MessageSquare,
  NotebookPen,
  Video,
} from "lucide-react";
import {
  AppShell,
  type AppShellNavGroup,
  type AppShellUser,
} from "#/components/app-shell";

const TUTOR_NAV_GROUPS: readonly AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/tutor/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/tutor/sessions", label: "Sessions", icon: Video },
      { to: "/tutor/claims/", label: "Claims", icon: ClipboardCheck },
      { to: "/tutor/earnings", label: "Earnings", icon: Coins },
    ],
  },
  {
    label: "Teaching",
    items: [
      { to: "/tutor/messaging", label: "Messaging", icon: MessageSquare },
      { to: "/tutor/schedules", label: "Schedules", icon: Calendar },
      { to: "/tutor/notes", label: "Notes", icon: NotebookPen },
      {
        to: "/tutor/register-generation",
        label: "Register generation",
        icon: FileSpreadsheet,
      },
    ],
  },
] as const;

export function TutorAppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: ReactNode;
}) {
  return (
    <AppShell
      homePath="/tutor/"
      helpPath="/tutor/help"
      notificationsPath="/tutor/notifications"
      brandMark={<span className="text-xs font-bold">TS</span>}
      brandTitle="Tutor Studio"
      brandSubtitle="Emeris Learning"
      navGroups={TUTOR_NAV_GROUPS}
      user={user}
      fallbackDisplayName="Tutor"
    >
      {children}
    </AppShell>
  );
}

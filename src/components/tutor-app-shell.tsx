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
import { APP_PATHS } from "#/lib/app-paths";

const TUTOR_NAV_GROUPS: readonly AppShellNavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: APP_PATHS.tutor.home, label: "Dashboard", icon: LayoutDashboard },
      { to: APP_PATHS.tutor.sessions, label: "Sessions", icon: Video },
      { to: APP_PATHS.tutor.claims, label: "Claims", icon: ClipboardCheck },
      { to: APP_PATHS.tutor.earnings, label: "Earnings", icon: Coins },
    ],
  },
  {
    label: "Teaching",
    items: [
      { to: APP_PATHS.tutor.messaging, label: "Messaging", icon: MessageSquare },
      { to: APP_PATHS.tutor.schedules, label: "Schedules", icon: Calendar },
      { to: APP_PATHS.tutor.notes, label: "Notes", icon: NotebookPen },
      {
        to: APP_PATHS.tutor.registerGeneration,
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
      homePath={APP_PATHS.tutor.home}
      helpPath={APP_PATHS.tutor.help}
      notificationsPath={APP_PATHS.tutor.notifications}
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

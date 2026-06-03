import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  FileText,
  MessageSquare,
  UserPlus,
  Wallet,
} from "lucide-react";
import { APP_PATHS } from "#/lib/app-paths";

export const ADMIN_QUICK_ACTIONS = [
  {
    label: "Approve Claims",
    to: APP_PATHS.admin.approvals,
    icon: ClipboardCheck,
  },
  {
    label: "Create Schedule",
    to: APP_PATHS.admin.schedules,
    icon: Calendar,
  },
  {
    label: "Export Payroll",
    to: APP_PATHS.admin.payments,
    icon: Wallet,
    soon: true,
  },
  {
    label: "Add Lecturer",
    to: APP_PATHS.admin.users,
    icon: UserPlus,
  },
  {
    label: "Broadcast",
    to: APP_PATHS.admin.messaging,
    icon: MessageSquare,
  },
  {
    label: "Generate Reports",
    to: APP_PATHS.admin.reports,
    icon: FileText,
  },
  {
    label: "Analytics",
    to: APP_PATHS.admin.analytics,
    icon: BarChart3,
  },
] as const;

import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  FileText,
  MessageSquare,
  UserPlus,
  Wallet,
} from "lucide-react";

export const ADMIN_QUICK_ACTIONS = [
  {
    label: "Approve Claims",
    to: "/admin/approvals" as const,
    icon: ClipboardCheck,
  },
  {
    label: "Create Schedule",
    to: "/admin/schedules" as const,
    icon: Calendar,
  },
  {
    label: "Export Payroll",
    to: "/admin/payments" as const,
    icon: Wallet,
    soon: true,
  },
  {
    label: "Add Lecturer",
    to: "/admin/users" as const,
    icon: UserPlus,
  },
  {
    label: "Broadcast",
    to: "/admin/messaging" as const,
    icon: MessageSquare,
  },
  {
    label: "Generate Reports",
    to: "/admin/reports" as const,
    icon: FileText,
  },
  {
    label: "Analytics",
    to: "/admin/analytics" as const,
    icon: BarChart3,
  },
] as const;

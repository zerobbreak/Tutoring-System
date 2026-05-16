import {
  Calendar,
  ClipboardList,
  Download,
  FileText,
  MessageSquare,
  Users,
} from "lucide-react";

export const LECTURER_QUICK_ACTIONS = [
  {
    label: "Review Claims",
    to: "/lecturer/verification-queue" as const,
    icon: ClipboardList,
  },
  {
    label: "Manage Tutors",
    to: "/lecturer/tutors" as const,
    icon: Users,
  },
  {
    label: "Open Schedule",
    to: "/lecturer/schedule" as const,
    icon: Calendar,
  },
  {
    label: "Message Tutors",
    to: "/lecturer/messages" as const,
    icon: MessageSquare,
  },
  {
    label: "Export Attendance",
    to: "/lecturer/attendance" as const,
    icon: Download,
  },
  {
    label: "Generate Report",
    to: "/lecturer/reports" as const,
    icon: FileText,
  },
] as const;

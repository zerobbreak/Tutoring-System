import {
  Calendar,
  ClipboardList,
  Download,
  FileText,
  MessageSquare,
  Users,
} from "lucide-react";
import { APP_PATHS } from "#/lib/app-paths";

export const LECTURER_QUICK_ACTIONS = [
  {
    label: "Review Claims",
    to: APP_PATHS.lecturer.verificationQueue,
    icon: ClipboardList,
  },
  {
    label: "Manage Tutors",
    to: APP_PATHS.lecturer.tutors,
    icon: Users,
  },
  {
    label: "Open Schedule",
    to: APP_PATHS.lecturer.schedule,
    icon: Calendar,
  },
  {
    label: "Message Tutors",
    to: APP_PATHS.lecturer.messages,
    icon: MessageSquare,
  },
  {
    label: "Export Attendance",
    to: APP_PATHS.lecturer.attendance,
    icon: Download,
  },
  {
    label: "Generate Report",
    to: APP_PATHS.lecturer.reports,
    icon: FileText,
  },
] as const;

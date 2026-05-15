import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import type { LecturerActivityItemDTO } from "#/server-actions/lecturer-dashboard";

export function activityIcon(kind: LecturerActivityItemDTO["kind"]) {
  switch (kind) {
    case "CLAIM_SUBMITTED":
      return CheckCircle2;
    case "DISPUTE_OPENED":
      return AlertTriangle;
    case "STATUS_CHANGED":
      return ClipboardList;
    default:
      return MessageSquare;
  }
}

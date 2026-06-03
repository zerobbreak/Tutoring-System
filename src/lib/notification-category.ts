export type NotificationCategory =
  | "ACTION_REQUIRED"
  | "SCHEDULE_CHANGE"
  | "APPROVAL_UPDATE"
  | "ATTENDANCE_ISSUE"
  | "INFORMATIONAL";

const ACTION_REQUIRED = new Set([
  "CLAIM_DRAFT_REMINDER",
  "CLAIM_PENDING_REMINDER",
]);

const SCHEDULE_CHANGE = new Set([
  "SESSION_TIME_CHANGED",
  "SESSION_VENUE_CHANGED",
  "SESSION_TUTOR_CHANGED",
  "SESSION_CANCELLED",
  "SESSION_RESTORED",
  "SESSION_DELETED",
  "SCHEDULE_CHANGE_APPROVED",
  "SCHEDULE_CHANGE_REJECTED",
]);

const APPROVAL_UPDATE = new Set([
  "CLAIM_VERIFIED",
  "CLAIM_APPROVED",
  "CLAIM_REJECTED",
  "CLAIM_DISPUTED",
  "SYSTEM",
]);

export function notificationCategory(
  type: string,
): NotificationCategory {
  if (ACTION_REQUIRED.has(type)) return "ACTION_REQUIRED";
  if (SCHEDULE_CHANGE.has(type)) return "SCHEDULE_CHANGE";
  if (APPROVAL_UPDATE.has(type)) return "APPROVAL_UPDATE";
  if (type.includes("ATTENDANCE")) return "ATTENDANCE_ISSUE";
  return "INFORMATIONAL";
}

export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  string
> = {
  ACTION_REQUIRED: "Action required",
  SCHEDULE_CHANGE: "Schedule",
  APPROVAL_UPDATE: "Approvals",
  ATTENDANCE_ISSUE: "Attendance",
  INFORMATIONAL: "Updates",
};

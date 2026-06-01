import type { AdminUserCategory } from "#/server-actions/admin-users";
import type { AdminScheduleCalendarScope } from "#/server-actions/admin-schedules";

export const queryKeys = {
  admin: {
    all: ["admin"] as const,
    dashboard: ["admin", "dashboard"] as const,
    users: (filters: { category: AdminUserCategory; search?: string }) =>
      ["admin", "users", filters] as const,
    sessions: (filters: {
      lookbackDays: number;
      moduleId?: string;
      tutorId?: string;
      lecturerId?: string;
    }) => ["admin", "sessions", filters] as const,
    schedules: (filters: {
      from: string;
      to: string;
      academicTermId: string | null;
      scope: AdminScheduleCalendarScope;
      scopeEntityId: string | null;
    }) => ["admin", "schedules", filters] as const,
    scheduleIssues: (filters: {
      from: string;
      to: string;
      academicTermId: string | null;
      scope: AdminScheduleCalendarScope;
      scopeEntityId: string | null;
    }) => ["admin", "schedule-issues", filters] as const,
  },
  lecturer: {
    all: ["lecturer"] as const,
    dashboard: ["lecturer", "dashboard"] as const,
    verificationQueue: (filters: { search?: string; moduleId?: string }) =>
      ["lecturer", "verification-queue", filters] as const,
    schedule: (filters: { from: string; to: string }) =>
      ["lecturer", "schedule", filters] as const,
  },
  tutor: {
    all: ["tutor"] as const,
    dashboard: ["tutor", "dashboard"] as const,
    sessionClaims: ["tutor", "session-claims"] as const,
    assignedSchedule: (filters: { from: string; to: string }) =>
      ["tutor", "assigned-schedule", filters] as const,
  },
  messaging: {
    all: ["messaging"] as const,
    conversations: ["messaging", "conversations"] as const,
    messages: (conversationId: string) =>
      ["messaging", "messages", conversationId] as const,
  },
} as const;

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
    approvals: (filters: { search?: string; moduleId?: string }) =>
      ["admin", "approvals", filters] as const,
    institutions: ["admin", "institutions"] as const,
    venues: ["admin", "venues"] as const,
    venueSchedules: (venueId: string) =>
      ["admin", "venue-schedules", venueId] as const,
    auditLogActors: ["admin", "audit-logs", "actors"] as const,
    auditLogs: (filters: {
      category: string;
      actorId: string | null;
      moduleId: string | null;
      from?: string;
      to?: string;
    }) => ["admin", "audit-logs", filters] as const,
    analytics: ["admin", "analytics"] as const,
    payroll: ["admin", "payroll"] as const,
    reportsPage: ["admin", "reports-page"] as const,
  },
  lecturer: {
    all: ["lecturer"] as const,
    dashboard: ["lecturer", "dashboard"] as const,
    verificationQueue: (filters: { search?: string; moduleId?: string }) =>
      ["lecturer", "verification-queue", filters] as const,
    schedule: (filters: { from: string; to: string }) =>
      ["lecturer", "schedule", filters] as const,
    roomAccess: (filters: { from: string; to: string }) =>
      ["lecturer", "room-access", filters] as const,
    roomAccessAccess: ["lecturer", "room-access-access"] as const,
    tutors: ["lecturer", "tutors"] as const,
    sessions: ["lecturer", "sessions"] as const,
    attendance: ["lecturer", "attendance"] as const,
    analytics: ["lecturer", "analytics"] as const,
    reportsPage: ["lecturer", "reports-page"] as const,
  },
  tutor: {
    all: ["tutor"] as const,
    dashboard: ["tutor", "dashboard"] as const,
    sessionClaims: ["tutor", "session-claims"] as const,
    assignedSchedule: (filters: { from: string; to: string }) =>
      ["tutor", "assigned-schedule", filters] as const,
    venueUnlockStatus: (filters: { from: string; to: string }) =>
      ["tutor", "venue-unlock-status", filters] as const,
    earnings: ["tutor", "earnings"] as const,
    notesClaims: ["tutor", "notes-claims"] as const,
  },
  settings: {
    profile: ["settings", "profile"] as const,
  },
  messaging: {
    all: ["messaging"] as const,
    conversations: ["messaging", "conversations"] as const,
    messages: (conversationId: string) =>
      ["messaging", "messages", conversationId] as const,
  },
} as const;

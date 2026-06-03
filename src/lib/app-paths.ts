/** In-app route targets — must match TanStack `routeTree.gen.ts` fullPath values. */

export const APP_PATHS = {
  auth: {
    login: "/auth/login",
    mfa: "/auth/mfa",
    register: "/auth/register",
    forgotPassword: "/auth/forgot-password",
    recoverPassword: "/auth/recover-password",
    accountBlocked: "/auth/account-blocked",
  },
  settings: "/settings",
  admin: {
    /** TanStack `to` target for the dashboard index (see `routeTree.gen.ts`). */
    home: "/admin",
    approvals: "/admin/approvals",
    institutions: "/admin/institutions",
    users: "/admin/users",
    schedules: "/admin/schedules",
    sessions: "/admin/sessions",
    payments: "/admin/payments",
    messaging: "/admin/messaging",
    analytics: "/admin/analytics",
    reports: "/admin/reports",
    auditLogs: "/admin/audit-logs",
  },
  lecturer: {
    home: "/lecturer",
    verificationQueue: "/lecturer/verification-queue",
    schedule: "/lecturer/schedule",
    sessions: "/lecturer/sessions",
    tutors: "/lecturer/tutors",
    attendance: "/lecturer/attendance",
    messages: "/lecturer/messages",
    analytics: "/lecturer/analytics",
    reports: "/lecturer/reports",
  },
  tutor: {
    home: "/tutor",
    sessions: "/tutor/sessions",
    claims: "/tutor/claims",
    claimDetail: "/tutor/claims/$claimId",
    earnings: "/tutor/earnings",
    messaging: "/tutor/messaging",
    schedules: "/tutor/schedules",
    notes: "/tutor/notes",
    registerGeneration: "/tutor/register-generation",
    help: "/tutor/help",
    notifications: "/tutor/notifications",
  },
} as const;

export type DashboardPath =
  | typeof APP_PATHS.admin.home
  | typeof APP_PATHS.lecturer.home
  | typeof APP_PATHS.tutor.home
  | typeof APP_PATHS.settings;

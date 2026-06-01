export const APP_PATHS = {
  auth: {
    login: "/auth/login",
    mfa: "/auth/mfa",
    accountBlocked: "/auth/account-blocked",
  },
  settings: "/settings",
  admin: "/admin",
  lecturer: "/lecturer",
  tutor: "/tutor",
} as const;

export type DashboardPath =
  | typeof APP_PATHS.admin
  | typeof APP_PATHS.lecturer
  | typeof APP_PATHS.tutor
  | typeof APP_PATHS.settings;

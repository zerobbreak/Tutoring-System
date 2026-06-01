import {
  hasPlatformAccess,
  isAccountBlocked,
  type UserStatus,
} from "#/lib/user-status";
import { APP_PATHS, type DashboardPath } from "#/lib/app-paths";

/** Matches Postgres `CREATE TYPE user_role AS ENUM (...)` */
export const USER_ROLES = [
  "TUTOR",
  "LECTURER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Roles assignable via admin-issued registration invites. */
export const SELF_REGISTER_ROLES = ["TUTOR", "LECTURER", "ADMIN"] as const;
export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

export function isAdminDashboardRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isLecturerDashboardRole(role: string | undefined): boolean {
  return role === "LECTURER";
}

export function isTutorDashboardRole(role: string | undefined): boolean {
  return role === "TUTOR";
}

/** Default app entry for an authenticated user (no bare `/` home route). */
export function getPostAuthDashboardPath(
  role: string | undefined,
): DashboardPath {
  if (isAdminDashboardRole(role)) return APP_PATHS.admin;
  if (isLecturerDashboardRole(role)) return APP_PATHS.lecturer;
  if (isTutorDashboardRole(role)) return APP_PATHS.tutor;
  return APP_PATHS.settings;
}

export type PostAuthDestination =
  | DashboardPath
  | typeof APP_PATHS.auth.accountBlocked;

/** Route after sign-in based on role and account lifecycle. */
export function getPostAuthDestination(
  role: string | undefined,
  userStatus: UserStatus | string | null | undefined,
): PostAuthDestination {
  if (userStatus && isAccountBlocked(userStatus)) {
    return APP_PATHS.auth.accountBlocked;
  }
  if (userStatus && !hasPlatformAccess(userStatus)) {
    return APP_PATHS.settings;
  }
  return getPostAuthDashboardPath(role);
}

/** e.g. SUPER_ADMIN → Super Admin, TUTOR → Tutor */
export function formatRoleLabel(role: string | undefined): string {
  if (!role) return "User";
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

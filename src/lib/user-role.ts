import {
  hasPlatformAccess,
  isAccountBlocked,
  type UserStatus,
} from "#/lib/user-status";

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
): "/admin" | "/lecturer" | "/tutor" | "/settings" {
  if (isAdminDashboardRole(role)) return "/admin";
  if (isLecturerDashboardRole(role)) return "/lecturer";
  if (isTutorDashboardRole(role)) return "/tutor";
  return "/settings";
}

export type PostAuthDestination =
  | "/admin"
  | "/lecturer"
  | "/tutor"
  | "/settings"
  | "/auth/account-blocked";

/** Route after sign-in based on role and account lifecycle. */
export function getPostAuthDestination(
  role: string | undefined,
  userStatus: UserStatus | string | null | undefined,
): PostAuthDestination {
  if (userStatus && isAccountBlocked(userStatus)) {
    return "/auth/account-blocked";
  }
  if (userStatus && !hasPlatformAccess(userStatus)) {
    return "/settings";
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

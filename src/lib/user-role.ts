/** Matches Postgres `CREATE TYPE user_role AS ENUM (...)` */
export const USER_ROLES = [
  "TUTOR",
  "LECTURER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Self-service registration — `SUPER_ADMIN` is assigned only by admins. */
export const SELF_REGISTER_ROLES = ["TUTOR", "LECTURER", "ADMIN"] as const;
export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

export function isAdminDashboardRole(role: string | undefined): boolean {
  return (
    role === "ADMIN" ||
    role === "LECTURER" ||
    role === "SUPER_ADMIN"
  );
}

export function isTutorDashboardRole(role: string | undefined): boolean {
  return role === "TUTOR";
}

/** Default app entry for an authenticated user (no bare `/` home route). */
export function getPostAuthDashboardPath(
  role: string | undefined,
): "/admin" | "/tutor" | "/settings" {
  if (isAdminDashboardRole(role)) return "/admin";
  if (isTutorDashboardRole(role)) return "/tutor";
  return "/settings";
}

/** e.g. SUPER_ADMIN → Super Admin, TUTOR → Tutor */
export function formatRoleLabel(role: string | undefined): string {
  if (!role) return "User";
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

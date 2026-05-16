import type { ClaimStatus } from "#/lib/session-claim-display";

export function formatVerificationSummary(
  actionType: string,
  actorName: string,
  actorRole: string,
  moduleCode: string | null,
  claimId: string,
  toStatus: string | null,
): string {
  const shortId = claimId.slice(0, 8);
  const mod = moduleCode ? ` (${moduleCode})` : "";

  switch (actionType) {
    case "ADMIN_APPROVED":
      return `${actorName} approved claim ${shortId}${mod}`;
    case "ADMIN_REJECTED":
      return `${actorName} rejected claim ${shortId}${mod}`;
    case "LECTURER_VERIFIED":
    case "VERIFIED":
      return `${actorName} verified claim ${shortId}${mod}`;
    case "LECTURER_REJECTED":
    case "REJECTED":
      return `${actorName} rejected claim ${shortId}${mod}`;
    case "DISPUTED":
    case "DISPUTE_RAISED":
      return `${actorName} disputed claim ${shortId}${mod}`;
    case "CLARIFICATION_REQUESTED":
      return `${actorName} requested clarification on claim ${shortId}${mod}`;
    case "ESCALATED":
      return `${actorName} escalated claim ${shortId}${mod}`;
    case "FROZEN":
    case "ADMIN_FROZEN":
      return `${actorName} froze claim ${shortId}${mod}`;
    default:
      if (toStatus) {
        return `${actorName} updated claim ${shortId} to ${toStatus}${mod}`;
      }
      return `${actorName} (${actorRole}) — ${actionType.replace(/_/g, " ").toLowerCase()}${mod}`;
  }
}

export function formatAuditLogSummary(
  event: string,
  actorName: string | null,
  entityType: string,
  payload: Record<string, unknown> | null,
): string {
  const who = actorName ?? "System";
  if (event === "ROLE_CHANGED" && payload) {
    return `${who} changed role to ${String(payload.to ?? "unknown")}`;
  }
  if (event === "USER_ONBOARDING_REVIEWED" && payload) {
    return `${who} ${String(payload.decision ?? "reviewed")} user onboarding`;
  }
  if (event === "USER_ACTIVE_CHANGED" && payload) {
    return `${who} ${payload.is_active ? "activated" : "deactivated"} user account`;
  }
  if (event === "SCHEDULE_SERIES_CREATED" && payload) {
    return `${who} created schedule series “${String(payload.title ?? "Untitled")}”`;
  }
  if (event === "SCHEDULE_SERIES_PUBLISHED" && payload) {
    return `${who} published schedule series “${String(payload.title ?? "Untitled")}”`;
  }
  if (event === "MFA_RESET_BY_ADMIN") {
    return `${who} reset MFA for a user`;
  }
  if (event === "STATUS_CHANGED" && entityType === "SESSION_CLAIM" && payload) {
    return `Claim status changed ${String(payload.from)} → ${String(payload.to)}`;
  }
  return `${who} — ${event.replace(/_/g, " ").toLowerCase()}`;
}

export function formatScheduleReviewSummary(
  status: string,
  reviewerName: string,
  moduleCode: string | null,
): string {
  const mod = moduleCode ? ` for ${moduleCode}` : "";
  if (status === "APPROVED") {
    return `${reviewerName} approved schedule change${mod}`;
  }
  return `${reviewerName} rejected schedule change${mod}`;
}

export function formatMfaEventSummary(
  eventType: string,
  userName: string,
  status: string,
): string {
  const label = eventType.replace(/_/g, " ").toLowerCase();
  return `${userName} — ${label} (${status})`;
}

export function mapVerificationCategory(actionType: string): "APPROVAL" | "SECURITY" {
  const security = ["ESCALATED", "FROZEN", "ADMIN_FROZEN"];
  if (security.includes(actionType)) return "SECURITY";
  return "APPROVAL";
}

export function isSuspiciousMfaEvent(eventType: string): boolean {
  return /failed|lockout|suspicious|denied/i.test(eventType);
}

export function claimStatusLabel(status: string | null): ClaimStatus | null {
  if (!status) return null;
  return status as ClaimStatus;
}

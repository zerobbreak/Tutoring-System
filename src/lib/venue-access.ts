export const VENUE_ACCESS_CONTROLS = ["OPEN", "FACIAL_RECOGNITION"] as const;

export type VenueAccessControl = (typeof VENUE_ACCESS_CONTROLS)[number];

export function isMissingVenueAccessControlColumnError(
  error: { message?: string | null } | null | undefined,
): boolean {
  const message = error?.message ?? "";
  return message.includes("access_control") && message.includes("does not exist");
}

export const VENUE_UNLOCK_STATUSES = [
  "PENDING",
  "CLAIMED",
  "URGENT",
  "COMPLETED",
  "CANCELLED",
] as const;

export type VenueUnlockStatus = (typeof VENUE_UNLOCK_STATUSES)[number];

export function venueAccessControlLabel(value: VenueAccessControl): string {
  switch (value) {
    case "FACIAL_RECOGNITION":
      return "Requires staff unlock (facial access)";
    case "OPEN":
    default:
      return "Open access";
  }
}

export function venueUnlockStatusLabel(status: VenueUnlockStatus): string {
  switch (status) {
    case "PENDING":
      return "Unlock needed";
    case "CLAIMED":
      return "Opening claimed";
    case "URGENT":
      return "Urgent — unlock needed";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export type UnlockSchedulingSettings = {
  unlock_digest_hour?: number;
  unlock_alert_minutes_before?: number;
  unlock_urgent_minutes_before?: number;
};

export function parseUnlockSchedulingSettings(
  raw: unknown,
): UnlockSchedulingSettings {
  if (!raw || typeof raw !== "object") return {};
  return raw as UnlockSchedulingSettings;
}

export function getUnlockDigestHour(settings: UnlockSchedulingSettings): number {
  const h = settings.unlock_digest_hour;
  return typeof h === "number" && h >= 0 && h <= 23 ? h : 7;
}

export function getUnlockAlertMinutesBefore(
  settings: UnlockSchedulingSettings,
): number {
  const m = settings.unlock_alert_minutes_before;
  return typeof m === "number" && m > 0 ? m : 15;
}

export function getUnlockUrgentMinutesBefore(
  settings: UnlockSchedulingSettings,
): number {
  const m = settings.unlock_urgent_minutes_before;
  return typeof m === "number" && m > 0 ? m : 5;
}

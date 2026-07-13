import { describe, expect, it } from "vitest";
import {
  getUnlockAlertMinutesBefore,
  getUnlockDigestHour,
  getUnlockUrgentMinutesBefore,
  parseUnlockSchedulingSettings,
  venueAccessControlLabel,
  venueUnlockStatusLabel,
} from "#/lib/venue-access";

describe("venue-access settings", () => {
  it("uses defaults when settings are empty", () => {
    expect(getUnlockDigestHour(parseUnlockSchedulingSettings(null))).toBe(7);
    expect(getUnlockAlertMinutesBefore(parseUnlockSchedulingSettings({}))).toBe(
      15,
    );
    expect(getUnlockUrgentMinutesBefore(parseUnlockSchedulingSettings({}))).toBe(
      5,
    );
  });

  it("reads custom unlock timing from scheduling_settings", () => {
    const settings = parseUnlockSchedulingSettings({
      unlock_digest_hour: 8,
      unlock_alert_minutes_before: 20,
      unlock_urgent_minutes_before: 10,
    });
    expect(getUnlockDigestHour(settings)).toBe(8);
    expect(getUnlockAlertMinutesBefore(settings)).toBe(20);
    expect(getUnlockUrgentMinutesBefore(settings)).toBe(10);
  });
});

describe("venue-access labels", () => {
  it("labels access control modes", () => {
    expect(venueAccessControlLabel("OPEN")).toContain("Open");
    expect(venueAccessControlLabel("FACIAL_RECOGNITION")).toContain("unlock");
  });

  it("labels unlock request statuses", () => {
    expect(venueUnlockStatusLabel("PENDING")).toBe("Unlock needed");
    expect(venueUnlockStatusLabel("CLAIMED")).toBe("Opening claimed");
    expect(venueUnlockStatusLabel("URGENT")).toContain("Urgent");
  });
});

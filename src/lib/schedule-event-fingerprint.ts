import { createHash } from "node:crypto";
import type { ScheduleParsedEvent } from "#/lib/schedule-spreadsheet";

export type ScheduleEventFingerprintInput = Pick<
  ScheduleParsedEvent,
  "start" | "end" | "title" | "moduleCode"
>;

/** Canonical string for hashing; must stay stable across client reloads. */
export function canonicalScheduleEventString(
  ev: ScheduleEventFingerprintInput,
): string {
  const module = (ev.moduleCode ?? "").trim().toUpperCase();
  return `${ev.start}\u001f${ev.end}\u001f${ev.title.trim()}\u001f${module}`;
}

/** Server / Node: SHA-256 hex of the canonical event identity. */
export function scheduleEventFingerprint(
  ev: ScheduleEventFingerprintInput,
): string {
  return createHash("sha256")
    .update(canonicalScheduleEventString(ev), "utf8")
    .digest("hex");
}

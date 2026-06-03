import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import { eventTypeLabel } from "#/lib/schedule-sync/classify-change";
import type { ScheduleSyncEvent } from "#/lib/schedule-sync/types";

const NOTIFICATION_TYPE_BY_EVENT = {
  SESSION_TIME_CHANGED: "SESSION_TIME_CHANGED",
  VENUE_CHANGED: "SESSION_VENUE_CHANGED",
  TUTOR_REASSIGNED: "SESSION_TUTOR_CHANGED",
  SESSION_CANCELLED: "SESSION_CANCELLED",
  SESSION_RESTORED: "SESSION_RESTORED",
} as const;

function sessionWhen(after: ScheduleSyncEvent["after"]): string {
  const start = parseISO(after.startsAt);
  const end = parseISO(after.endsAt);
  return `${format(start, "EEE d MMM yyyy")} · ${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
}

function buildBody(event: ScheduleSyncEvent): string {
  const mod = `${event.after.moduleCode} · ${event.after.moduleName}`;
  const when = sessionWhen(event.after);
  const venue =
    event.after.claimSnapshot.venue?.trim() || event.after.venueText || "—";

  switch (event.type) {
    case "SESSION_TIME_CHANGED":
      return `${mod} is now scheduled for ${when}.`;
    case "VENUE_CHANGED":
      return `${mod} on ${when} — venue is now ${venue}.`;
    case "TUTOR_REASSIGNED":
      return `${mod} on ${when} — tutoring assignment was updated.`;
    case "SESSION_CANCELLED":
      return `${mod} on ${when} has been cancelled. Attendance scanning is closed.`;
    case "SESSION_RESTORED":
      return `${mod} on ${when} has been restored on the schedule.`;
    default:
      return `${mod} schedule was updated.`;
  }
}

/** In-app notifications for tutor and module lecturer. */
export async function notifyScheduleSyncRecipients(
  db: SupabaseClient,
  event: ScheduleSyncEvent,
  claimId: string | null,
): Promise<void> {
  const notifType =
    NOTIFICATION_TYPE_BY_EVENT[
      event.type as keyof typeof NOTIFICATION_TYPE_BY_EVENT
    ] ?? "SYSTEM";

  const subject = eventTypeLabel(event.type);
  const body = buildBody(event);

  const recipientIds = new Set<string>();
  recipientIds.add(event.after.tutorId);
  if (event.after.lecturerId) recipientIds.add(event.after.lecturerId);

  if (event.type === "TUTOR_REASSIGNED" && event.before?.tutorId) {
    recipientIds.add(event.before.tutorId);
  }

  recipientIds.delete(event.actorId);

  const rows = [...recipientIds].map((recipient_id) => ({
    recipient_id,
    claim_id: claimId,
    channel: "IN_APP" as const,
    type: notifType as string,
    subject,
    body,
  }));

  if (!rows.length) return;

  const { error } = await db.from("notifications").insert(rows);
  if (error) throw new Error(error.message);
}

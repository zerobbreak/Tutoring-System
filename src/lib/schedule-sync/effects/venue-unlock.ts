import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import type { ScheduleSyncEvent } from "#/lib/schedule-sync/types";
import {
  isMissingVenueAccessControlColumnError,
  type VenueUnlockStatus,
} from "#/lib/venue-access";

type Db = SupabaseClient;

export async function venueRequiresUnlock(
  db: Db,
  venueId: string | null,
): Promise<boolean> {
  if (!venueId) return false;
  const { data, error } = await db
    .from("venues")
    .select("access_control, is_active")
    .eq("id", venueId)
    .maybeSingle();
  if (error) {
    if (isMissingVenueAccessControlColumnError(error)) {
      const { data: fallbackData, error: fallbackError } = await db
        .from("venues")
        .select("is_active")
        .eq("id", venueId)
        .maybeSingle();
      if (fallbackError) throw new Error(fallbackError.message);
      return Boolean(fallbackData?.is_active);
    }
    throw new Error(error.message);
  }
  if (!data?.is_active) return false;
  const accessControl = (data as { access_control?: unknown }).access_control;
  return accessControl === "FACIAL_RECOGNITION";
}

async function notifyUnlockCancelled(
  db: Db,
  input: {
    recipientId: string;
    claimId: string | null;
    subject: string;
    body: string;
  },
): Promise<void> {
  const { error } = await db.from("notifications").insert({
    recipient_id: input.recipientId,
    claim_id: input.claimId,
    channel: "IN_APP",
    type: "VENUE_UNLOCK_CANCELLED",
    subject: input.subject,
    body: input.body,
  });
  if (error) throw new Error(error.message);
}

function sessionWhen(startsAt: string, endsAt: string): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  return `${format(start, "EEE d MMM yyyy")} · ${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
}

async function cancelUnlockRequest(
  db: Db,
  scheduledSessionId: string,
  after: ScheduleSyncEvent["after"],
): Promise<void> {
  const { data: existing, error: fetchErr } = await db
    .from("venue_unlock_requests")
    .select("id, status, claimed_by")
    .eq("scheduled_session_id", scheduledSessionId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing?.id) return;
  if (existing.status === "CANCELLED" || existing.status === "COMPLETED") return;

  const { error } = await db
    .from("venue_unlock_requests")
    .update({
      status: "CANCELLED",
      claimed_by: null,
      claimed_at: null,
    })
    .eq("id", existing.id as string);

  if (error) throw new Error(error.message);

  const claimantId = existing.claimed_by as string | null;
  if (claimantId) {
    const mod = `${after.moduleCode} · ${after.moduleName}`;
    const when = sessionWhen(after.startsAt, after.endsAt);
    const venue =
      after.claimSnapshot.venue?.trim() || after.venueText || "the venue";
    await notifyUnlockCancelled(db, {
      recipientId: claimantId,
      claimId: null,
      subject: "Room unlock no longer needed",
      body: `${mod} on ${when} at ${venue} was cancelled — you do not need to open the room.`,
    });
  }
}

async function upsertPendingUnlockRequest(
  db: Db,
  input: {
    institutionId: string;
    scheduledSessionId: string;
    preserveClaim?: boolean;
  },
): Promise<void> {
  const { data: existing, error: fetchErr } = await db
    .from("venue_unlock_requests")
    .select("id, status, claimed_by")
    .eq("scheduled_session_id", input.scheduledSessionId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);

  if (existing?.id) {
    if (existing.status === "CANCELLED") {
      const patch: Record<string, unknown> = {
        status: input.preserveClaim && existing.claimed_by ? "CLAIMED" : "PENDING",
        urgent_at: null,
      };
      if (!input.preserveClaim || !existing.claimed_by) {
        patch.claimed_by = null;
        patch.claimed_at = null;
      }
      const { error } = await db
        .from("venue_unlock_requests")
        .update(patch)
        .eq("id", existing.id as string);
      if (error) throw new Error(error.message);
    }
    return;
  }

  const { error } = await db.from("venue_unlock_requests").insert({
    institution_id: input.institutionId,
    scheduled_session_id: input.scheduledSessionId,
    status: "PENDING",
  });

  if (error) throw new Error(error.message);
}

/** Sync venue unlock request after schedule materialize or explicit session row. */
export async function syncVenueUnlockForSessionRow(
  db: Db,
  input: {
    institutionId: string;
    scheduledSessionId: string;
    venueId: string | null;
    status: string;
  },
): Promise<void> {
  if (input.status === "CANCELLED") {
    const { data: req } = await db
      .from("venue_unlock_requests")
      .select("id")
      .eq("scheduled_session_id", input.scheduledSessionId)
      .maybeSingle();
    if (req?.id) {
      await db
        .from("venue_unlock_requests")
        .update({
          status: "CANCELLED" as VenueUnlockStatus,
          claimed_by: null,
          claimed_at: null,
        })
        .eq("id", req.id as string);
    }
    return;
  }

  const needsUnlock = await venueRequiresUnlock(db, input.venueId);
  if (!needsUnlock) {
    const { data: req } = await db
      .from("venue_unlock_requests")
      .select("id, status")
      .eq("scheduled_session_id", input.scheduledSessionId)
      .maybeSingle();
    if (req?.id && req.status !== "CANCELLED" && req.status !== "COMPLETED") {
      await db
        .from("venue_unlock_requests")
        .update({ status: "CANCELLED", claimed_by: null, claimed_at: null })
        .eq("id", req.id as string);
    }
    return;
  }

  await upsertPendingUnlockRequest(db, {
    institutionId: input.institutionId,
    scheduledSessionId: input.scheduledSessionId,
    preserveClaim: true,
  });
}

/** Schedule-sync event handler for venue unlock requests. */
export async function syncVenueUnlockFromSchedule(
  db: Db,
  event: ScheduleSyncEvent,
): Promise<void> {
  const { after, scheduledSessionId } = event;

  if (event.type === "SESSION_CANCELLED") {
    await cancelUnlockRequest(db, scheduledSessionId, after);
    return;
  }

  const needsUnlock = await venueRequiresUnlock(db, after.venueId);
  if (!needsUnlock) {
    await cancelUnlockRequest(db, scheduledSessionId, after);
    return;
  }

  if (
    event.type === "SESSION_RESTORED" ||
    event.type === "SESSION_TIME_CHANGED" ||
    event.type === "VENUE_CHANGED" ||
    event.type === "TUTOR_REASSIGNED"
  ) {
    await upsertPendingUnlockRequest(db, {
      institutionId: after.institutionId,
      scheduledSessionId,
      preserveClaim: event.type !== "SESSION_RESTORED",
    });
  }
}

/** Cancel unlock when session is soft-deleted (no schedule sync event). */
export async function cancelVenueUnlockForSoftDeletedSession(
  db: Db,
  scheduledSessionId: string,
): Promise<void> {
  const { data: session, error: sessErr } = await db
    .from("scheduled_sessions")
    .select(
      `
      id,
      starts_at,
      ends_at,
      venue_text,
      module:modules ( code, name ),
      series:schedule_series ( tutor_id )
    `,
    )
    .eq("id", scheduledSessionId)
    .maybeSingle();

  if (sessErr) throw new Error(sessErr.message);

  const { data: existing, error: fetchErr } = await db
    .from("venue_unlock_requests")
    .select("id, status, claimed_by")
    .eq("scheduled_session_id", scheduledSessionId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing?.id) return;
  if (existing.status === "CANCELLED" || existing.status === "COMPLETED") return;

  const { error } = await db
    .from("venue_unlock_requests")
    .update({ status: "CANCELLED", claimed_by: null, claimed_at: null })
    .eq("id", existing.id as string);

  if (error) throw new Error(error.message);

  const claimantId = existing.claimed_by as string | null;
  if (claimantId && session) {
    const mod = session.module as unknown as { code: string; name: string } | null;
    const label = mod ? `${mod.code} · ${mod.name}` : "A session";
    const when = session.starts_at && session.ends_at
      ? sessionWhen(session.starts_at as string, session.ends_at as string)
      : "the scheduled time";
    await notifyUnlockCancelled(db, {
      recipientId: claimantId,
      claimId: null,
      subject: "Room unlock no longer needed",
      body: `${label} on ${when} was removed from the schedule — you do not need to open the room.`,
    });
  }
}

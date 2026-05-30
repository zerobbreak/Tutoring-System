import type { SupabaseClient } from "@supabase/supabase-js";
import { restoreSoftDeleteFields } from "#/lib/soft-delete";
import { resolveTutorClaimWriteDb } from "./claim-write-db";
import { claimSnapshotFromScheduledSession } from "./claim-snapshot";
import type { ScheduledSessionForClaim } from "./types";

type ClaimRow = {
  id: string;
  status: string;
  frozen_at: string | null;
};

const MAX_SYNC_DRAFT_CLAIMS_PER_LIST = 40;

const SESSION_SELECT = `
  id,
  module_id,
  tutor_id,
  starts_at,
  ends_at,
  venue_text,
  status,
  venue:venues ( name ),
  series:schedule_series ( session_kind )
`;

async function syncDraftClaimFromSnapshot(
  db: SupabaseClient,
  claimId: string,
  snapshot: ReturnType<typeof claimSnapshotFromScheduledSession>,
): Promise<void> {
  const { error } = await db
    .from("session_claims")
    .update({
      session_date: snapshot.session_date,
      start_time: snapshot.start_time,
      end_time: snapshot.end_time,
      hours: snapshot.hours,
      venue: snapshot.venue,
      tutor_id: snapshot.tutor_id,
      module_id: snapshot.module_id,
      session_kind: snapshot.session_kind,
    })
    .eq("id", claimId)
    .eq("status", "DRAFT")
    .is("frozen_at", null)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

async function findActiveClaimForSession(
  db: SupabaseClient,
  scheduledSessionId: string,
): Promise<ClaimRow | null> {
  const { data, error } = await db
    .from("session_claims")
    .select("id, status, frozen_at")
    .eq("source_scheduled_session_id", scheduledSessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ClaimRow | null;
}

async function findTombstonedClaimForSession(
  db: SupabaseClient,
  scheduledSessionId: string,
  tutorId: string,
): Promise<ClaimRow | null> {
  const { data, error } = await db
    .from("session_claims")
    .select("id, status, frozen_at")
    .eq("source_scheduled_session_id", scheduledSessionId)
    .eq("tutor_id", tutorId)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ClaimRow | null;
}

/** Align DRAFT schedule-linked claims with current `scheduled_sessions` rows (best-effort). */
export async function syncTutorDraftClaimsFromSchedule(
  db: SupabaseClient,
  tutorId: string,
): Promise<void> {
  const { data, error } = await db
    .from("session_claims")
    .select("source_scheduled_session_id")
    .eq("tutor_id", tutorId)
    .eq("status", "DRAFT")
    .is("frozen_at", null)
    .is("deleted_at", null)
    .not("source_scheduled_session_id", "is", null);

  if (error || !data?.length) return;

  const sessionIds = [
    ...new Set(
      data
        .map((r) => r.source_scheduled_session_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ].slice(0, MAX_SYNC_DRAFT_CLAIMS_PER_LIST);

  for (const sessionId of sessionIds) {
    try {
      await ensureScheduledSessionClaim(db, sessionId);
    } catch {
      /* best-effort */
    }
  }
}

/** Create or return session_claim for a published occurrence; sync DRAFT fields from schedule. */
export async function ensureScheduledSessionClaim(
  db: SupabaseClient,
  scheduledSessionId: string,
): Promise<string> {
  const { data: session, error: sessErr } = await db
    .from("scheduled_sessions")
    .select(SESSION_SELECT)
    .eq("id", scheduledSessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (sessErr) throw new Error(sessErr.message);
  if (!session) throw new Error("Scheduled session not found.");

  const row = session as unknown as ScheduledSessionForClaim & { status: string };
  if (row.status === "CANCELLED") {
    throw new Error("Cannot create a claim for a cancelled session.");
  }

  const snapshot = claimSnapshotFromScheduledSession(row);
  const claimDb = await resolveTutorClaimWriteDb(db, snapshot.tutor_id);

  const existing = await findActiveClaimForSession(claimDb, scheduledSessionId);
  if (existing?.id) {
    if (existing.status === "DRAFT" && !existing.frozen_at) {
      await syncDraftClaimFromSnapshot(claimDb, existing.id, snapshot);
    }
    return existing.id;
  }

  const tombstone = await findTombstonedClaimForSession(
    claimDb,
    scheduledSessionId,
    snapshot.tutor_id,
  );
  if (tombstone?.id) {
    const { error: restoreErr } = await claimDb
      .from("session_claims")
      .update(restoreSoftDeleteFields())
      .eq("id", tombstone.id);

    if (restoreErr) throw new Error(restoreErr.message);

    if (tombstone.status === "DRAFT" && !tombstone.frozen_at) {
      await syncDraftClaimFromSnapshot(claimDb, tombstone.id, snapshot);
    }
    return tombstone.id;
  }

  const claimRow = {
    tutor_id: snapshot.tutor_id,
    module_id: snapshot.module_id,
    session_date: snapshot.session_date,
    start_time: snapshot.start_time,
    end_time: snapshot.end_time,
    hours: snapshot.hours,
    venue: snapshot.venue,
    status: "DRAFT" as const,
    source_scheduled_session_id: snapshot.source_scheduled_session_id,
    session_kind: snapshot.session_kind,
    creation_source: snapshot.creation_source,
  };

  const { data: inserted, error: insErr } = await claimDb
    .from("session_claims")
    .insert(claimRow)
    .select("id")
    .single();

  if (!insErr && inserted?.id) return inserted.id as string;

  if (insErr?.code === "23505") {
    const again = await findActiveClaimForSession(claimDb, scheduledSessionId);
    if (again?.id) {
      if (again.status === "DRAFT" && !again.frozen_at) {
        await syncDraftClaimFromSnapshot(claimDb, again.id, snapshot);
      }
      return again.id;
    }
  }

  throw new Error(insErr?.message ?? "Could not create session claim.");
}

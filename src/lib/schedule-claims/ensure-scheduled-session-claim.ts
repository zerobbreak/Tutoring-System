import type { SupabaseClient } from "@supabase/supabase-js";
import { claimSnapshotFromScheduledSession } from "./claim-snapshot";
import type { ScheduledSessionForClaim } from "./types";

type ClaimRow = {
  id: string;
  status: string;
  frozen_at: string | null;
};

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

  const { data: existing, error: selErr } = await db
    .from("session_claims")
    .select("id, status, frozen_at")
    .eq("source_scheduled_session_id", scheduledSessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);

  if (existing?.id) {
    const claim = existing as ClaimRow;
    if (claim.status === "DRAFT" && !claim.frozen_at) {
      await syncDraftClaimFromSnapshot(db, claim.id, snapshot);
    }
    return claim.id;
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

  const { data: inserted, error: insErr } = await db
    .from("session_claims")
    .insert(claimRow)
    .select("id")
    .single();

  if (!insErr && inserted?.id) return inserted.id as string;

  if (insErr?.code === "23505") {
    const { data: again } = await db
      .from("session_claims")
      .select("id, status, frozen_at")
      .eq("source_scheduled_session_id", scheduledSessionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (again?.id) {
      const claim = again as ClaimRow;
      if (claim.status === "DRAFT" && !claim.frozen_at) {
        await syncDraftClaimFromSnapshot(db, claim.id, snapshot);
      }
      return claim.id as string;
    }
  }

  throw new Error(insErr?.message ?? "Could not create session claim.");
}

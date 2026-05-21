import type { SupabaseClient } from "@supabase/supabase-js";
import { logInstitutionAudit } from "#/lib/audit-log";
import {
  loadScheduledSessionSnapshot,
  syncScheduledSessionAfterUpdate,
} from "#/lib/schedule-sync";
import {
  softDeleteDraftClaimsForSession,
  softDeleteScheduledSession,
} from "#/lib/soft-delete";

type Supabase = SupabaseClient;

export type ManagedSessionRow = {
  id: string;
  status: string;
  tutor_id: string;
  module_id: string;
  series_id: string;
  starts_at: string;
};

export async function fetchManagedSession(
  supabase: Supabase,
  sessionId: string,
): Promise<ManagedSessionRow> {
  const { data, error } = await supabase
    .from("scheduled_sessions")
    .select("id, status, tutor_id, module_id, series_id, starts_at")
    .eq("id", sessionId)
    .is("deleted_at", null)
    .single();

  if (error || !data) throw new Error("Session not found.");
  return data as ManagedSessionRow;
}

export async function assertNoBlockingClaims(
  supabase: Supabase,
  sessionId: string,
): Promise<void> {
  const { data: claims, error } = await supabase
    .from("session_claims")
    .select("id, status")
    .eq("source_scheduled_session_id", sessionId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const blocking = (claims ?? []).find((c) => c.status !== "DRAFT");
  if (blocking) {
    throw new Error(
      "This session has a submitted or approved claim. Cancel it instead of deleting.",
    );
  }
}

async function rejectPendingChangeRequests(
  supabase: Supabase,
  sessionId: string,
  reviewerId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("schedule_change_requests")
    .update({
      status: "REJECTED",
      reviewed_by: reviewerId,
      reviewed_at: now,
    })
    .eq("scheduled_session_id", sessionId)
    .eq("status", "PENDING");
}

export async function cancelScheduledSessionRecord(
  supabase: Supabase,
  params: {
    sessionId: string;
    actorId: string;
    reason: string;
    institutionId?: string;
  },
): Promise<void> {
  const session = await fetchManagedSession(supabase, params.sessionId);
  if (session.status === "CANCELLED") {
    throw new Error("This session is already cancelled.");
  }

  const before = await loadScheduledSessionSnapshot(supabase, params.sessionId);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("scheduled_sessions")
    .update({
      status: "CANCELLED",
      cancelled_at: now,
      cancelled_by: params.actorId,
      cancellation_reason: params.reason.trim(),
      restored_at: null,
      restored_by: null,
    })
    .eq("id", params.sessionId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  await rejectPendingChangeRequests(supabase, params.sessionId, params.actorId);

  if (before) {
    await syncScheduledSessionAfterUpdate(supabase, {
      scheduledSessionId: params.sessionId,
      actorId: params.actorId,
      before,
    });
  } else if (params.institutionId) {
    await logInstitutionAudit(supabase, {
      institutionId: params.institutionId,
      actorId: params.actorId,
      entityType: "SCHEDULED_SESSION",
      entityId: params.sessionId,
      event: "SCHEDULED_SESSION_CANCELLED",
      payload: { reason: params.reason.trim() },
    });
  }
}

export async function restoreScheduledSessionRecord(
  supabase: Supabase,
  params: {
    sessionId: string;
    actorId: string;
    institutionId: string;
  },
): Promise<void> {
  const { data: session, error: fetchErr } = await supabase
    .from("scheduled_sessions")
    .select("id, status")
    .eq("id", params.sessionId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !session) throw new Error("Session not found.");
  if (session.status !== "CANCELLED") {
    throw new Error("Only cancelled sessions can be restored.");
  }

  const before = await loadScheduledSessionSnapshot(supabase, params.sessionId);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("scheduled_sessions")
    .update({
      status: "SCHEDULED",
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      restored_at: now,
      restored_by: params.actorId,
    })
    .eq("id", params.sessionId);

  if (error) throw new Error(error.message);

  if (before) {
    await syncScheduledSessionAfterUpdate(supabase, {
      scheduledSessionId: params.sessionId,
      actorId: params.actorId,
      before,
    });
  } else {
    await logInstitutionAudit(supabase, {
      institutionId: params.institutionId,
      actorId: params.actorId,
      entityType: "SCHEDULED_SESSION",
      entityId: params.sessionId,
      event: "SCHEDULED_SESSION_RESTORED",
      payload: {},
    });
  }
}

export async function deleteScheduledSessionRecord(
  supabase: Supabase,
  params: {
    sessionId: string;
    actorId: string;
    reason: string;
    institutionId?: string;
  },
): Promise<void> {
  const session = await fetchManagedSession(supabase, params.sessionId);
  await assertNoBlockingClaims(supabase, params.sessionId);

  await softDeleteDraftClaimsForSession(
    supabase,
    params.sessionId,
    params.actorId,
    params.reason,
  );

  await rejectPendingChangeRequests(supabase, params.sessionId, params.actorId);

  await softDeleteScheduledSession(
    supabase,
    params.sessionId,
    params.actorId,
    params.reason,
  );

  if (params.institutionId) {
    await logInstitutionAudit(supabase, {
      institutionId: params.institutionId,
      actorId: params.actorId,
      entityType: "SCHEDULED_SESSION",
      entityId: params.sessionId,
      event: "SCHEDULED_SESSION_SOFT_DELETED",
      payload: {
        reason: params.reason.trim(),
        module_id: session.module_id,
        starts_at: session.starts_at,
      },
    });
  }
}

export async function assertScheduledSessionActiveForPayroll(
  supabase: Supabase,
  claimId: string,
): Promise<void> {
  const { data: claim, error } = await supabase
    .from("session_claims")
    .select("source_scheduled_session_id, deleted_at")
    .eq("id", claimId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (claim?.deleted_at) {
    throw new Error("Cannot approve payment for a deleted claim.");
  }

  const sessionId = claim?.source_scheduled_session_id as string | null;
  if (!sessionId) return;

  const { data: session, error: sessErr } = await supabase
    .from("scheduled_sessions")
    .select("status, deleted_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessErr) throw new Error(sessErr.message);
  if (session?.deleted_at) {
    throw new Error(
      "Cannot approve payment for a claim linked to a deleted session.",
    );
  }
  if (session?.status === "CANCELLED") {
    throw new Error(
      "Cannot approve payment for a claim linked to a cancelled session.",
    );
  }
}

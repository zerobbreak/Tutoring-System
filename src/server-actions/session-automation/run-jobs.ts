import { addHours, subHours } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import {
  extendAllPublishedSeries,
  materializeSeriesSessionsIncremental,
} from "#/lib/schedule-materialize";
import {
  ATTENDANCE_LOCK_GRACE_MINUTES,
  isAttendanceLocked,
  qrWindowForScheduledSession,
} from "#/lib/session-qr-window";

const AUTO_SUBMIT_GRACE_HOURS = 2;
const DRAFT_REMINDER_HOURS = 48;
const PENDING_REMINDER_HOURS = 72;

export type SessionAutomationJobResult = {
  seriesExtended: number;
  attendanceLocked: number;
  qrTokensRefreshed: number;
  autoSubmitted: number;
  remindersSent: number;
};

async function lockEndedAttendance(db: SupabaseClient): Promise<number> {
  const { data: rows, error } = await db
    .from("session_claims")
    .select(
      `
      id,
      attendance_locked_at,
      source_scheduled_session_id,
      session_date,
      start_time,
      end_time,
      scheduled:scheduled_sessions ( starts_at, ends_at )
    `,
    )
    .eq("status", "DRAFT")
    .is("attendance_locked_at", null)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  let locked = 0;
  const now = new Date();

  for (const row of rows ?? []) {
    const scheduled = row.scheduled as { starts_at: string; ends_at: string } | null;
    let bounds: { startsAt: string; endsAt: string } | null = null;
    if (scheduled?.starts_at && scheduled?.ends_at) {
      bounds = { startsAt: scheduled.starts_at, endsAt: scheduled.ends_at };
    } else if (row.session_date && row.start_time && row.end_time) {
      bounds = {
        startsAt: `${row.session_date}T${row.start_time}`,
        endsAt: `${row.session_date}T${row.end_time}`,
      };
    }
    if (!bounds || !isAttendanceLocked(bounds, now)) continue;

    const { error: upErr } = await db
      .from("session_claims")
      .update({ attendance_locked_at: now.toISOString() })
      .eq("id", row.id as string);

    if (!upErr) locked += 1;
  }

  return locked;
}

async function refreshQrTokensInWindow(db: SupabaseClient): Promise<number> {
  const now = new Date();
  const windowStart = subHours(now, 1).toISOString();
  const windowEnd = addHours(now, 24).toISOString();

  const { data: sessions, error } = await db
    .from("scheduled_sessions")
    .select("id, starts_at, ends_at")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .in("status", ["SCHEDULED", "RESCHEDULED"])
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  let refreshed = 0;
  for (const s of sessions ?? []) {
    const bounds = { startsAt: s.starts_at as string, endsAt: s.ends_at as string };
    const { validFrom, validUntil } = qrWindowForScheduledSession(bounds);
    if (now < validFrom || now > validUntil) continue;

    const { data: claim } = await db
      .from("session_claims")
      .select("id, qr_token")
      .eq("source_scheduled_session_id", s.id as string)
      .is("deleted_at", null)
      .maybeSingle();

    if (!claim?.id) continue;

    const qr_token = claim.qr_token ?? crypto.randomUUID();
    const { error: upErr } = await db
      .from("session_claims")
      .update({
        qr_token,
        qr_expires_at: validUntil.toISOString(),
      })
      .eq("id", claim.id as string);

    if (!upErr) refreshed += 1;
  }

  return refreshed;
}

async function claimHasAttendanceOrEvidence(
  db: SupabaseClient,
  claimId: string,
): Promise<boolean> {
  const [{ count: attCount }, { count: evCount }] = await Promise.all([
    db
      .from("session_attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", claimId)
      .is("deleted_at", null),
    db
      .from("attendance_evidence")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", claimId),
  ]);

  return (attCount ?? 0) > 0 || (evCount ?? 0) > 0;
}

async function autoSubmitEligibleClaims(db: SupabaseClient): Promise<number> {
  const cutoff = subHours(new Date(), AUTO_SUBMIT_GRACE_HOURS).toISOString();

  const { data: institutions, error: instErr } = await db
    .from("institutions")
    .select("id")
    .eq("auto_submit_claims", true);

  if (instErr) throw new Error(instErr.message);
  if (!institutions?.length) return 0;

  let submitted = 0;

  for (const inst of institutions) {
    const { data: modules } = await db
      .from("modules")
      .select("id")
      .eq("institution_id", inst.id as string);

    const moduleIds = (modules ?? []).map((m) => m.id as string);
    if (!moduleIds.length) continue;

    const { data: claims, error: claimErr } = await db
      .from("session_claims")
      .select(
        `
        id,
        tutor_id,
        session_date,
        end_time,
        frozen_at,
        auto_submitted_at,
        module:modules!inner ( institution_id )
      `,
      )
      .in("module_id", moduleIds)
      .eq("status", "DRAFT")
      .is("frozen_at", null)
      .is("auto_submitted_at", null)
      .is("deleted_at", null);

    if (claimErr) throw new Error(claimErr.message);

    const { data: instRow } = await db
      .from("institutions")
      .select("auto_submit_requires_attendance")
      .eq("id", inst.id as string)
      .single();

    const requiresAttendance = instRow?.auto_submit_requires_attendance !== false;

    for (const claim of claims ?? []) {
      const sessionEnd = `${claim.session_date}T${claim.end_time}`;
      if (sessionEnd > cutoff) continue;

      if (requiresAttendance) {
        const ok = await claimHasAttendanceOrEvidence(db, claim.id as string);
        if (!ok) continue;
      }

      const now = new Date().toISOString();
      const { error: upErr } = await db
        .from("session_claims")
        .update({
          status: "PENDING_VERIFICATION",
          submitted_at: now,
          auto_submitted_at: now,
        })
        .eq("id", claim.id as string)
        .eq("status", "DRAFT");

      if (upErr) continue;

      await db.from("verification_actions").insert({
        claim_id: claim.id as string,
        actor_id: claim.tutor_id as string,
        action_type: "AUTO_SUBMITTED",
        from_status: "DRAFT",
        to_status: "PENDING_VERIFICATION",
        comment: "Submitted automatically by institution policy.",
      });
      submitted += 1;
    }
  }

  return submitted;
}

async function insertReminderIfNew(
  db: SupabaseClient,
  input: {
    recipientId: string;
    claimId: string;
    type: string;
    subject: string;
    body: string;
  },
): Promise<boolean> {
  const since = subHours(new Date(), 20).toISOString();
  const { data: existing } = await db
    .from("notifications")
    .select("id")
    .eq("recipient_id", input.recipientId)
    .eq("claim_id", input.claimId)
    .eq("type", input.type)
    .gte("created_at", since)
    .maybeSingle();

  if (existing?.id) return false;

  const { error } = await db.from("notifications").insert({
    recipient_id: input.recipientId,
    claim_id: input.claimId,
    channel: "IN_APP",
    type: input.type,
    subject: input.subject,
    body: input.body,
  });

  if (error) throw new Error(error.message);
  return true;
}

async function runSessionReminders(db: SupabaseClient): Promise<number> {
  let sent = 0;
  const now = new Date();
  const upcomingCutoff = addHours(now, 24).toISOString();
  const nowIso = now.toISOString();

  const { data: upcomingSessions, error: upErr } = await db
    .from("scheduled_sessions")
    .select("id, starts_at, tutor_id, module:modules ( code )")
    .gte("starts_at", nowIso)
    .lte("starts_at", upcomingCutoff)
    .eq("status", "SCHEDULED")
    .is("deleted_at", null);

  if (upErr) throw new Error(upErr.message);

  for (const s of upcomingSessions ?? []) {
    const mod = s.module as { code: string } | null;
    const { data: claim } = await db
      .from("session_claims")
      .select("id")
      .eq("source_scheduled_session_id", s.id as string)
      .maybeSingle();

    if (!claim?.id) continue;

    const ok = await insertReminderIfNew(db, {
      recipientId: s.tutor_id as string,
      claimId: claim.id as string,
      type: "SESSION_UPCOMING",
      subject: "Upcoming session",
      body: `You have ${mod?.code ?? "a"} session starting within 24 hours.`,
    });
    if (ok) sent += 1;
  }

  const draftCutoff = subHours(now, DRAFT_REMINDER_HOURS).toISOString();
  const { data: staleDrafts, error: draftErr } = await db
    .from("session_claims")
    .select("id, tutor_id, session_date, module:modules ( code )")
    .eq("status", "DRAFT")
    .is("deleted_at", null);

  if (draftErr) throw new Error(draftErr.message);

  for (const c of staleDrafts ?? []) {
    const sessionEnd = `${c.session_date}T23:59:59`;
    if (sessionEnd > draftCutoff) continue;
    const mod = c.module as { code: string } | null;
    const ok = await insertReminderIfNew(db, {
      recipientId: c.tutor_id as string,
      claimId: c.id as string,
      type: "CLAIM_DRAFT_REMINDER",
      subject: "Submit your session claim",
      body: `Your draft claim for ${mod?.code ?? "a module"} on ${c.session_date} is ready to submit.`,
    });
    if (ok) sent += 1;
  }

  const pendingCutoff = subHours(now, PENDING_REMINDER_HOURS).toISOString();
  const { data: pendingClaims, error: pendErr } = await db
    .from("session_claims")
    .select(
      `
      id,
      session_date,
      submitted_at,
      module:modules ( code, lecturer_id )
    `,
    )
    .eq("status", "PENDING_VERIFICATION")
    .is("deleted_at", null);

  if (pendErr) throw new Error(pendErr.message);

  for (const c of pendingClaims ?? []) {
    const submittedAt = c.submitted_at as string | null;
    if (!submittedAt || submittedAt > pendingCutoff) continue;
    const mod = c.module as { code: string; lecturer_id: string | null } | null;
    if (!mod?.lecturer_id) continue;
    const ok = await insertReminderIfNew(db, {
      recipientId: mod.lecturer_id,
      claimId: c.id as string,
      type: "CLAIM_PENDING_REMINDER",
      subject: "Claim awaiting verification",
      body: `A claim for ${mod.code} on ${c.session_date} has been pending for over 72 hours.`,
    });
    if (ok) sent += 1;
  }

  return sent;
}

export async function runSessionAutomationJobs(
  db: SupabaseClient = getSupabaseAdmin(),
): Promise<SessionAutomationJobResult> {
  const { seriesExtended } = await extendAllPublishedSeries(db);
  const attendanceLocked = await lockEndedAttendance(db);
  const qrTokensRefreshed = await refreshQrTokensInWindow(db);
  const autoSubmitted = await autoSubmitEligibleClaims(db);
  const remindersSent = await runSessionReminders(db);

  return {
    seriesExtended,
    attendanceLocked,
    qrTokensRefreshed,
    autoSubmitted,
    remindersSent,
  };
}

/** Re-materialize a single published series (admin repair). */
export async function repairPublishedSeries(
  db: SupabaseClient,
  seriesId: string,
): Promise<void> {
  await materializeSeriesSessionsIncremental(db, seriesId);
}

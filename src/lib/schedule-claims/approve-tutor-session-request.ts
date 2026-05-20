import { parse } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  appendClaimWorkflowEvent,
  CLAIM_WORKFLOW_ACTION,
} from "#/lib/claim-workflow-timeline";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";
import { buildDtstartFromDateAndTime } from "#/lib/schedule-recurrence";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";
import { isTutorManualSessionClaim } from "#/lib/tutor-manual-session-claim";
import { publishScheduleSeriesCore } from "./publish-schedule-series-core";
import { ensureScheduledSessionClaim } from "./ensure-scheduled-session-claim";
import { checkReservedCapacityForOccurrences } from "#/server-actions/tutor-allocations/check-reserved-capacity";

type Db = SupabaseClient;

export type TutorSessionRequestClaimRow = {
  id: string;
  tutor_id: string;
  module_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number | string;
  venue: string | null;
  session_kind: string | null;
  status: string;
  request_status: string | null;
  source_scheduled_session_id: string | null;
  source_schedule_import_id: string | null;
  admin_creation_approved_at: string | null;
};

function parseClockToDate(
  sessionDate: string,
  time: string,
): Date {
  const base = parse(sessionDate, "yyyy-MM-dd", new Date());
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time.trim());
  if (!m) throw new Error("Invalid time on session request.");
  const h = Number(m[1]);
  const mi = Number(m[2]);
  const s = m[3] ? Number(m[3]) : 0;
  const d = new Date(base);
  d.setHours(h, mi, s, 0);
  return d;
}

function durationMinutesFromClaim(row: TutorSessionRequestClaimRow): number {
  const start = parseClockToDate(row.session_date, row.start_time);
  let end = parseClockToDate(row.session_date, row.end_time);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  const mins = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  if (mins < 15) throw new Error("Session must be at least 15 minutes.");
  if (mins > 24 * 60) throw new Error("Session duration exceeds 24 hours.");
  return mins;
}

export async function approveTutorSessionRequest(
  db: Db,
  input: {
    claimId: string;
    reviewerId: string;
    /** Module lecturer or admin — used as schedule_series.created_by */
    seriesCreatedBy: string;
  },
): Promise<{ ok: true; scheduledSessionId: string; alreadyApproved: boolean }> {
  const { data: row, error: selErr } = await db
    .from("session_claims")
    .select(
      `
      id,
      tutor_id,
      module_id,
      session_date,
      start_time,
      end_time,
      hours,
      venue,
      session_kind,
      status,
      request_status,
      source_scheduled_session_id,
      source_schedule_import_id,
      admin_creation_approved_at,
      module:modules ( id, code, institution_id, lecturer_id )
    `,
    )
    .eq("id", input.claimId)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);
  if (!row) throw new Error("Session not found.");
  const claim = row as TutorSessionRequestClaimRow & {
    module:
      | { id: string; code: string; institution_id: string; lecturer_id: string }
      | { id: string; code: string; institution_id: string; lecturer_id: string }[]
      | null;
  };

  if (!isTutorManualSessionClaim(claim)) {
    throw new Error("Only tutor-requested sessions use this approval flow.");
  }

  if (
    claim.request_status === SESSION_REQUEST_STATUS.APPROVED ||
    claim.admin_creation_approved_at
  ) {
    if (claim.source_scheduled_session_id) {
      return {
        ok: true,
        scheduledSessionId: claim.source_scheduled_session_id,
        alreadyApproved: true,
      };
    }
  }

  if (claim.request_status === SESSION_REQUEST_STATUS.REJECTED) {
    throw new Error("This session request was rejected.");
  }

  const modRaw = claim.module;
  const mod = Array.isArray(modRaw) ? modRaw[0] : modRaw;
  if (!mod) throw new Error("Module not found.");

  const start = parseClockToDate(claim.session_date, claim.start_time);
  let end = parseClockToDate(claim.session_date, claim.end_time);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  await checkReservedCapacityForOccurrences(db, {
    tutorId: claim.tutor_id,
    moduleId: claim.module_id,
    institutionId: mod.institution_id,
    occurrences: [{ startsAt: start, endsAt: end }],
    strict: true,
  });

  const durationMinutes = durationMinutesFromClaim(claim);
  const timeLabel = claim.start_time.slice(0, 5);
  const dtstart = buildDtstartFromDateAndTime(claim.session_date, timeLabel);
  const sessionKind = claim.session_kind?.trim() || "one_off";
  const title = `Tutor request: ${mod.code}`;

  const { data: inserted, error: insErr } = await db
    .from("schedule_series")
    .insert({
      module_id: claim.module_id,
      created_by: input.seriesCreatedBy,
      title,
      session_kind: sessionKind,
      tutor_id: claim.tutor_id,
      venue_id: null,
      venue_text: claim.venue?.trim() || null,
      timezone: "Africa/Johannesburg",
      dtstart,
      duration_minutes: durationMinutes,
      recurrence_json: {
        frequency: "explicit_dates",
        dates: [claim.session_date],
      },
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (insErr) throw new Error(insErr.message);
  const seriesId = inserted.id as string;

  await publishScheduleSeriesCore(db, {
    seriesId,
    materializeMode: "first_publish",
  });

  const { data: session, error: sessErr } = await db
    .from("scheduled_sessions")
    .select("id")
    .eq("series_id", seriesId)
    .is("deleted_at", null)
    .neq("status", "CANCELLED")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sessErr) throw new Error(sessErr.message);
  if (!session?.id) {
    throw new Error("Could not materialize scheduled session.");
  }

  const scheduledSessionId = session.id as string;

  const { data: dupes, error: dupErr } = await db
    .from("session_claims")
    .select("id")
    .eq("source_scheduled_session_id", scheduledSessionId)
    .neq("id", input.claimId)
    .is("deleted_at", null);

  if (dupErr) throw new Error(dupErr.message);
  for (const d of dupes ?? []) {
    const { error: delErr } = await db
      .from("session_claims")
      .delete()
      .eq("id", d.id as string);
    if (delErr) throw new Error(delErr.message);
  }

  const now = new Date().toISOString();
  const { error: upErr } = await db
    .from("session_claims")
    .update({
      source_scheduled_session_id: scheduledSessionId,
      request_status: SESSION_REQUEST_STATUS.APPROVED,
      reviewed_at: now,
      reviewed_by: input.reviewerId,
      admin_creation_approved_at: now,
      admin_creation_approved_by: input.reviewerId,
      creation_source: "SCHEDULE",
    })
    .eq("id", input.claimId);

  if (upErr) throw new Error(upErr.message);

  await ensureScheduledSessionClaim(db, scheduledSessionId);

  await appendClaimWorkflowEvent(db, {
    claimId: input.claimId,
    actorId: input.reviewerId,
    actionType: CLAIM_WORKFLOW_ACTION.SESSION_CREATION_APPROVED,
    fromStatus: claim.status as ClaimStatus,
    toStatus: claim.status as ClaimStatus,
  });

  return { ok: true, scheduledSessionId, alreadyApproved: false };
}

export async function previewTutorSessionRequestCapacity(
  db: Db,
  claim: {
    tutor_id: string;
    module_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    hours: number | string;
  },
): Promise<{
  allocatedHours: number | null;
  reservedHours: number;
  requestedHours: number;
  availableHours: number | null;
  canApprove: boolean;
  warning: string | null;
}> {
  const { data: mod, error: modErr } = await db
    .from("modules")
    .select("code, institution_id")
    .eq("id", claim.module_id)
    .maybeSingle();

  if (modErr) throw new Error(modErr.message);
  if (!mod) {
    return {
      allocatedHours: null,
      reservedHours: 0,
      requestedHours: 0,
      availableHours: null,
      canApprove: true,
      warning: null,
    };
  }

  const start = parseClockToDate(claim.session_date, claim.start_time);
  let end = parseClockToDate(claim.session_date, claim.end_time);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  const requestedHours = scheduleClaimTimesFromTimestamps(start, end).hours;

  const { getAllocationForModuleTerm, loadTutorBudgetContext, resolveAcademicTermIdForModule } =
    await import("#/server-actions/tutor-allocations/load-budget-context");

  const termId = await resolveAcademicTermIdForModule(
    db,
    claim.module_id,
    claim.session_date,
  );

  if (!termId) {
    return {
      allocatedHours: null,
      reservedHours: 0,
      requestedHours,
      availableHours: null,
      canApprove: true,
      warning: null,
    };
  }

  const allocated = await getAllocationForModuleTerm(
    db,
    claim.tutor_id,
    claim.module_id,
    termId,
  );

  if (allocated == null) {
    return {
      allocatedHours: null,
      reservedHours: 0,
      requestedHours,
      availableHours: null,
      canApprove: true,
      warning: "No hour allocation set for this module — approval is not blocked.",
    };
  }

  const { summary } = await loadTutorBudgetContext(
    db,
    claim.tutor_id,
    mod.institution_id as string,
  );

  const row = summary.byModule.find(
    (m) => m.moduleId === claim.module_id && m.academicTermId === termId,
  );
  const reservedHours = row?.reservedHours ?? 0;
  const availableHours = Math.max(
    0,
    Math.round((allocated - reservedHours) * 10) / 10,
  );
  const canApprove = reservedHours + requestedHours <= allocated + 0.001;
  const modCode = mod.code as string;

  return {
    allocatedHours: allocated,
    reservedHours,
    requestedHours,
    availableHours,
    canApprove,
    warning: canApprove
      ? null
      : `Requested ${requestedHours}h but only ${availableHours}h remaining for ${modCode} (${allocated}h allocated).`,
  };
}

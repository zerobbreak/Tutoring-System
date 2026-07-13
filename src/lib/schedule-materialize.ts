import { addWeeks, isAfter, max as maxDate } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertNoSchedulingConflicts,
  getModuleInstitutionId,
} from "#/lib/schedule-conflicts-assert";
import type { ScheduleSessionLike } from "#/lib/schedule-conflicts";
import {
  loadScheduledSessionSnapshotsForIds,
  syncCancelledSessionsBatch,
} from "#/lib/schedule-sync";
import { syncVenueUnlockForSessionRow } from "#/lib/schedule-sync/effects/venue-unlock";
import { restoreSoftDeleteFields } from "#/lib/soft-delete";
import {
  DEFAULT_PUBLISH_HORIZON_WEEKS,
  isExplicitDatesRecurrence,
  materializeOccurrences,
  parseRecurrenceJson,
  type MaterializedOccurrence,
} from "#/lib/schedule-recurrence";

export const ROLLING_EXTEND_HORIZON_DAYS = 30;

export type SeriesMaterializeInput = {
  id: string;
  module_id: string;
  tutor_id: string;
  venue_id: string | null;
  venue_text: string | null;
  dtstart: string;
  duration_minutes: number;
  recurrence_json: unknown;
  materialized_until: string | null;
};

export type ExistingScheduledRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  deleted_at: string | null;
};

export type MaterializePlanAction =
  | { kind: "insert"; startsAt: string; endsAt: string }
  | { kind: "update"; sessionId: string; endsAt: string }
  | { kind: "restore"; sessionId: string; endsAt: string }
  | { kind: "cancel"; sessionId: string };

export type MaterializePlan = {
  actions: MaterializePlanAction[];
  targetKeys: Set<string>;
  latestEndsAt: string | null;
};

export function occurrenceKey(startsAt: Date | string): string {
  return new Date(startsAt).toISOString();
}

/** Compute occurrences from series anchor through horizon (inclusive scan end). */
export function computeSeriesOccurrences(
  series: Pick<SeriesMaterializeInput, "dtstart" | "duration_minutes" | "recurrence_json">,
  options?: { horizonWeeks?: number; scanFrom?: Date },
): MaterializedOccurrence[] {
  const recurrence = parseRecurrenceJson(series.recurrence_json);
  const dtstart = new Date(series.dtstart);
  const scanFrom = options?.scanFrom ?? dtstart;
  const effectiveStart = isAfter(dtstart, scanFrom) ? dtstart : scanFrom;
  return materializeOccurrences({
    dtstart: effectiveStart,
    durationMinutes: series.duration_minutes,
    recurrence,
    horizonWeeks: options?.horizonWeeks ?? DEFAULT_PUBLISH_HORIZON_WEEKS,
  });
}

/** Pure plan: upsert/cancel actions from target occurrences vs existing rows. */
export function planMaterializeActions(
  occurrences: MaterializedOccurrence[],
  existing: ExistingScheduledRow[],
  now: Date,
): MaterializePlan {
  const targetKeys = new Set(occurrences.map((o) => occurrenceKey(o.startsAt)));
  const byStart = new Map<string, ExistingScheduledRow>();
  for (const row of existing) {
    byStart.set(occurrenceKey(row.starts_at), row);
  }

  const actions: MaterializePlanAction[] = [];
  let latestEndsAt: string | null = null;

  for (const o of occurrences) {
    const key = occurrenceKey(o.startsAt);
    const endsAt = o.endsAt.toISOString();
    if (!latestEndsAt || endsAt > latestEndsAt) latestEndsAt = endsAt;

    const row = byStart.get(key);
    if (!row) {
      actions.push({
        kind: "insert",
        startsAt: key,
        endsAt,
      });
      continue;
    }

    if (row.deleted_at) {
      actions.push({ kind: "restore", sessionId: row.id, endsAt });
      continue;
    }

    if (row.status === "SCHEDULED" && row.ends_at !== endsAt) {
      actions.push({ kind: "update", sessionId: row.id, endsAt });
    }
  }

  const nowIso = now.toISOString();
  for (const row of existing) {
    if (row.deleted_at) continue;
    if (row.status !== "SCHEDULED") continue;
    if (row.starts_at <= nowIso) continue;
    if (targetKeys.has(occurrenceKey(row.starts_at))) continue;
    actions.push({ kind: "cancel", sessionId: row.id });
  }

  return { actions, targetKeys, latestEndsAt };
}

export type MaterializeSeriesResult = {
  inserted: number;
  updated: number;
  restored: number;
  cancelled: number;
  totalActive: number;
};

type Db = SupabaseClient;

async function loadSeries(
  db: Db,
  seriesId: string,
): Promise<SeriesMaterializeInput> {
  const { data, error } = await db
    .from("schedule_series")
    .select(
      "id, module_id, tutor_id, venue_id, venue_text, dtstart, duration_minutes, recurrence_json, materialized_until",
    )
    .eq("id", seriesId)
    .is("deleted_at", null)
    .single();

  if (error) throw new Error(error.message);
  return data as SeriesMaterializeInput;
}

async function loadExistingSessions(
  db: Db,
  seriesId: string,
): Promise<ExistingScheduledRow[]> {
  const { data, error } = await db
    .from("scheduled_sessions")
    .select("id, starts_at, ends_at, status, deleted_at")
    .eq("series_id", seriesId);

  if (error) throw new Error(error.message);
  return (data ?? []) as ExistingScheduledRow[];
}

function buildProposedSessionsForPlan(
  series: SeriesMaterializeInput,
  plan: MaterializePlan,
  existing: ExistingScheduledRow[],
): ScheduleSessionLike[] {
  const existingById = new Map(existing.map((r) => [r.id, r]));
  const proposed: ScheduleSessionLike[] = [];

  for (const action of plan.actions) {
    if (action.kind === "cancel") continue;
    if (action.kind === "insert") {
      proposed.push({
        id: `pending-${action.startsAt}`,
        tutorId: series.tutor_id,
        moduleId: series.module_id,
        venueId: series.venue_id,
        startsAt: action.startsAt,
        endsAt: action.endsAt,
        status: "SCHEDULED",
      });
    } else {
      const row = existingById.get(action.sessionId);
      if (!row) continue;
      proposed.push({
        id: action.sessionId,
        tutorId: series.tutor_id,
        moduleId: series.module_id,
        venueId: series.venue_id,
        startsAt: row.starts_at,
        endsAt: action.endsAt,
        status: "SCHEDULED",
      });
    }
  }
  return proposed;
}

async function applyMaterializePlan(
  db: Db,
  series: SeriesMaterializeInput,
  plan: MaterializePlan,
  actorId: string,
  existing: ExistingScheduledRow[],
): Promise<MaterializeSeriesResult> {
  let inserted = 0;
  let updated = 0;
  let restored = 0;
  let cancelled = 0;
  const now = new Date().toISOString();

  const proposed = buildProposedSessionsForPlan(series, plan, existing);
  if (proposed.length > 0) {
    const institutionId = await getModuleInstitutionId(db, series.module_id);
    await assertNoSchedulingConflicts(db, {
      institutionId,
      proposedSessions: proposed,
    });
  }

  const cancelSessionIds = plan.actions
    .filter((a): a is Extract<MaterializePlanAction, { kind: "cancel" }> => a.kind === "cancel")
    .map((a) => a.sessionId);
  const beforeCancelSnapshots = await loadScheduledSessionSnapshotsForIds(
    db,
    cancelSessionIds,
  );

  for (const action of plan.actions) {
    if (action.kind === "insert") {
      const { data: insertedRow, error } = await db.from("scheduled_sessions").insert({
        series_id: series.id,
        module_id: series.module_id,
        tutor_id: series.tutor_id,
        starts_at: action.startsAt,
        ends_at: action.endsAt,
        venue_id: series.venue_id,
        venue_text: series.venue_text,
        status: "SCHEDULED",
        original_starts_at: action.startsAt,
      }).select("id").single();
      if (error) throw new Error(error.message);
      inserted += 1;
      const institutionId = await getModuleInstitutionId(db, series.module_id);
      await syncVenueUnlockForSessionRow(db, {
        institutionId,
        scheduledSessionId: insertedRow.id as string,
        venueId: series.venue_id,
        status: "SCHEDULED",
      });
    } else if (action.kind === "update") {
      const { error } = await db
        .from("scheduled_sessions")
        .update({
          ends_at: action.endsAt,
          venue_id: series.venue_id,
          venue_text: series.venue_text,
          tutor_id: series.tutor_id,
          module_id: series.module_id,
        })
        .eq("id", action.sessionId)
        .eq("status", "SCHEDULED")
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      updated += 1;
      const institutionId = await getModuleInstitutionId(db, series.module_id);
      await syncVenueUnlockForSessionRow(db, {
        institutionId,
        scheduledSessionId: action.sessionId,
        venueId: series.venue_id,
        status: "SCHEDULED",
      });
    } else if (action.kind === "restore") {
      const { error } = await db
        .from("scheduled_sessions")
        .update({
          ...restoreSoftDeleteFields(),
          ends_at: action.endsAt,
          venue_id: series.venue_id,
          venue_text: series.venue_text,
          tutor_id: series.tutor_id,
          module_id: series.module_id,
          status: "SCHEDULED",
        })
        .eq("id", action.sessionId);
      if (error) throw new Error(error.message);
      restored += 1;
      const institutionId = await getModuleInstitutionId(db, series.module_id);
      await syncVenueUnlockForSessionRow(db, {
        institutionId,
        scheduledSessionId: action.sessionId,
        venueId: series.venue_id,
        status: "SCHEDULED",
      });
    } else if (action.kind === "cancel") {
      const { error } = await db
        .from("scheduled_sessions")
        .update({
          status: "CANCELLED",
          cancelled_at: now,
          cancellation_reason: "Removed from schedule template",
        })
        .eq("id", action.sessionId)
        .eq("status", "SCHEDULED")
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      cancelled += 1;
    }
  }

  if (plan.latestEndsAt) {
    const { error } = await db
      .from("schedule_series")
      .update({ materialized_until: plan.latestEndsAt })
      .eq("id", series.id);
    if (error) throw new Error(error.message);
  }

  const { count, error: countErr } = await db
    .from("scheduled_sessions")
    .select("id", { count: "exact", head: true })
    .eq("series_id", series.id)
    .is("deleted_at", null)
    .neq("status", "CANCELLED");

  if (countErr) throw new Error(countErr.message);

  if (beforeCancelSnapshots.length > 0) {
    await syncCancelledSessionsBatch(
      db,
      beforeCancelSnapshots.map((before) => ({
        sessionId: before.id,
        actorId,
        before,
      })),
    );
  }

  return {
    inserted,
    updated,
    restored,
    cancelled,
    totalActive: count ?? 0,
  };
}

/** Incremental materialize for publish or full refresh (no soft-delete wipe). */
export async function materializeSeriesSessionsIncremental(
  db: Db,
  seriesId: string,
  actorId = "",
): Promise<MaterializeSeriesResult> {
  const series = await loadSeries(db, seriesId);
  const occurrences = computeSeriesOccurrences(series);
  const existing = await loadExistingSessions(db, seriesId);
  const plan = planMaterializeActions(occurrences, existing, new Date());
  return applyMaterializePlan(db, series, plan, actorId, existing);
}

/** Extend rolling horizon when materialized_until is within threshold. */
export async function extendSeriesHorizon(
  db: Db,
  seriesId: string,
  options?: { horizonWeeks?: number },
): Promise<MaterializeSeriesResult | null> {
  const series = await loadSeries(db, seriesId);
  const recurrence = parseRecurrenceJson(series.recurrence_json);
  if (isExplicitDatesRecurrence(recurrence)) {
    return null;
  }

  const now = new Date();

  if (!series.materialized_until) {
    return materializeSeriesSessionsIncremental(db, seriesId);
  }

  const materializedEnd = new Date(series.materialized_until);
  const threshold = addWeeks(now, 4);
  if (!isAfter(threshold, materializedEnd)) {
    return null;
  }

  const extendThrough = addWeeks(now, options?.horizonWeeks ?? DEFAULT_PUBLISH_HORIZON_WEEKS);

  const scanFrom = series.materialized_until
    ? maxDate([now, new Date(series.materialized_until)])
    : new Date(series.dtstart);

  const occurrences = materializeOccurrences({
    dtstart: scanFrom,
    durationMinutes: series.duration_minutes,
    recurrence,
    horizonWeeks: options?.horizonWeeks ?? DEFAULT_PUBLISH_HORIZON_WEEKS,
  }).filter((o) => !isAfter(o.startsAt, extendThrough));

  const existing = await loadExistingSessions(db, seriesId);
  const plan = planMaterializeActions(occurrences, existing, now);
  return applyMaterializePlan(db, series, plan, "", existing);
}

export async function extendAllPublishedSeries(
  db: Db,
  institutionId?: string,
): Promise<{ seriesExtended: number }> {
  let query = db
    .from("schedule_series")
    .select("id")
    .eq("status", "PUBLISHED")
    .is("deleted_at", null);

  if (institutionId) {
    query = query.eq("institution_id", institutionId);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  let seriesExtended = 0;
  for (const row of rows ?? []) {
    const result = await extendSeriesHorizon(db, row.id as string);
    if (result) seriesExtended += 1;
  }
  return { seriesExtended };
}

export function needsHorizonExtension(
  materializedUntil: string | null,
  now: Date = new Date(),
): boolean {
  if (!materializedUntil) return true;
  const threshold = addWeeks(now, 4);
  return isAfter(threshold, new Date(materializedUntil));
}

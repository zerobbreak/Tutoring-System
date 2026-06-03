import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extendSeriesHorizon,
  materializeSeriesSessionsIncremental,
} from "#/lib/schedule-materialize";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { checkReservedCapacityForSeriesPublish } from "#/server-actions/tutor-allocations/check-reserved-capacity";
import { reconcileSeriesClaims } from "./reconcile-series-claims";

export type PublishMaterializeMode = "first_publish" | "repair_horizon";

export type PublishScheduleSeriesCoreInput = {
  seriesId: string;
  materializeMode: PublishMaterializeMode;
  /** When false, only materialize + reconcile; caller updates series status (e.g. one-off create). */
  markPublished?: boolean;
  /** When false, materialize sessions but let the caller link/create claims. */
  reconcileClaims?: boolean;
  actorId?: string;
};

export type PublishScheduleSeriesCoreResult = {
  sessionCount: number;
  repairedOnly: boolean;
};

async function assertSeriesPublishable(
  db: SupabaseClient,
  seriesId: string,
): Promise<{ status: string }> {
  const { data: series, error } = await db
    .from("schedule_series")
    .select("id, status")
    .eq("id", seriesId)
    .is("deleted_at", null)
    .single();

  if (error) throw new Error(error.message);
  if (series.status === "ARCHIVED") {
    throw new Error("Cannot publish an archived series.");
  }
  return { status: series.status as string };
}

async function countActiveSessions(
  db: SupabaseClient,
  seriesId: string,
): Promise<number> {
  const { count, error } = await db
    .from("scheduled_sessions")
    .select("id", { count: "exact", head: true })
    .eq("series_id", seriesId)
    .is("deleted_at", null)
    .neq("status", "CANCELLED");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Materialize or extend horizon, reconcile claims, optionally mark series PUBLISHED.
 * Auth and audit remain at server-function edges.
 */
export async function publishScheduleSeriesCore(
  db: SupabaseClient,
  input: PublishScheduleSeriesCoreInput,
): Promise<PublishScheduleSeriesCoreResult> {
  const { seriesId, materializeMode } = input;
  const markPublished = input.markPublished !== false;

  const { status } = await assertSeriesPublishable(db, seriesId);
  const alreadyPublished = status === "PUBLISHED";
  const repairedOnly = materializeMode === "repair_horizon" || alreadyPublished;

  if (!repairedOnly) {
    await checkReservedCapacityForSeriesPublish(db, seriesId);
  }

  const actorId = input.actorId ?? "";

  if (materializeMode === "repair_horizon" || alreadyPublished) {
    await extendSeriesHorizon(db, seriesId);
  } else {
    await materializeSeriesSessionsIncremental(db, seriesId, actorId);
  }

  if (markPublished && !alreadyPublished) {
    const { error: pubErr } = await db
      .from("schedule_series")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
      })
      .eq("id", seriesId);

    if (pubErr) throw new Error(pubErr.message);
  }

  if (input.reconcileClaims !== false) {
    const claimDb = getSupabaseAdmin() ?? db;
    await reconcileSeriesClaims(claimDb, seriesId, { skipCancelled: true });
  }

  const sessionCount = await countActiveSessions(db, seriesId);

  return { sessionCount, repairedOnly };
}

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

export type ProcessJobOutboxResult = {
  processed: number;
  failed: number;
};

export function jobOutboxIdempotencyKey(
  jobType: string,
  payload: Record<string, unknown>,
): string {
  const raw = JSON.stringify({ jobType, payload });
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

/** Enqueue a row for cron processing (idempotent when key provided). */
export async function enqueueJobOutbox(
  db: SupabaseClient,
  input: {
    institutionId?: string | null;
    jobType: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  },
): Promise<void> {
  const key =
    input.idempotencyKey ??
    jobOutboxIdempotencyKey(input.jobType, input.payload);

  const { error } = await db.from("job_outbox").insert({
    institution_id: input.institutionId ?? null,
    job_type: input.jobType,
    payload: input.payload,
    idempotency_key: key,
    status: "pending",
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

async function markJob(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from("job_outbox").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

async function executeJob(
  _db: SupabaseClient,
  _jobType: string,
  _payload: Record<string, unknown>,
): Promise<void> {
  // Reserved for moving schedule-sync notify and bulk handlers here.
}

/** Process pending outbox rows with retry and dead-letter (failed status). */
export async function processJobOutbox(
  db: SupabaseClient,
): Promise<ProcessJobOutboxResult> {
  const { data: rows, error } = await db
    .from("job_outbox")
    .select("id, job_type, payload, attempts, institution_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let processed = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const id = row.id as string;
    const attempts = (row.attempts as number) + 1;

    await markJob(db, id, {
      status: "processing",
      attempts,
    });

    try {
      await executeJob(
        db,
        row.job_type as string,
        (row.payload as Record<string, unknown>) ?? {},
      );
      await markJob(db, id, {
        status: "done",
        processed_at: new Date().toISOString(),
        last_error: null,
      });
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Job failed";
      if (attempts >= MAX_ATTEMPTS) {
        await markJob(db, id, {
          status: "failed",
          last_error: message,
          processed_at: new Date().toISOString(),
        });
        failed += 1;
      } else {
        await markJob(db, id, {
          status: "pending",
          last_error: message,
        });
      }
    }
  }

  return { processed, failed };
}

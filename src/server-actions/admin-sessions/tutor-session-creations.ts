import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  appendClaimWorkflowEvent,
  CLAIM_WORKFLOW_ACTION,
} from "#/lib/claim-workflow-timeline";
import { requireAdminContext } from "#/lib/admin-server";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { isTutorManualSessionClaim } from "#/lib/tutor-manual-session-claim";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const claimIdSchema = z.object({
  claimId: z.string().uuid(),
});

export type PendingTutorSessionCreationDTO = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  venue: string | null;
  status: string;
  updated_at: string;
  tutor: { id: string; full_name: string; email: string } | null;
  module: { id: string; code: string; name: string } | null;
};

const PENDING_SELECT = `
  id,
  session_date,
  start_time,
  end_time,
  hours,
  venue,
  status,
  updated_at,
  source_scheduled_session_id,
  source_schedule_import_id,
  admin_creation_approved_at,
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email ),
  module:modules ( id, code, name )
`;

function mapPendingTutorSessionCreationRows(
  data: Record<string, unknown>[] | null,
): PendingTutorSessionCreationDTO[] {
  return (data ?? [])
    .filter((row) =>
      isTutorManualSessionClaim(
        row as {
          source_scheduled_session_id: string | null;
          source_schedule_import_id: string | null;
        },
      ),
    )
    .map((row) => {
      const tutorRaw = row.tutor;
      const tutor = Array.isArray(tutorRaw) ? tutorRaw[0] : tutorRaw;
      const moduleRaw = row.module;
      const module = Array.isArray(moduleRaw) ? moduleRaw[0] : moduleRaw;
      return {
        id: row.id as string,
        session_date: row.session_date as string,
        start_time: row.start_time as string,
        end_time: row.end_time as string,
        hours: Number(row.hours),
        venue: row.venue as string | null,
        status: row.status as string,
        updated_at: row.updated_at as string,
        tutor: tutor as PendingTutorSessionCreationDTO["tutor"],
        module: module as PendingTutorSessionCreationDTO["module"],
      };
    });
}

/** Shared loader for admin session-creation approval queue. */
export async function loadPendingTutorSessionCreations(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  limit = 100,
): Promise<PendingTutorSessionCreationDTO[]> {
  const { data, error } = await supabase
    .from("session_claims")
    .select(PENDING_SELECT)
    .is("admin_creation_approved_at", null)
    .is("source_scheduled_session_id", null)
    .is("source_schedule_import_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return mapPendingTutorSessionCreationRows(
    (data ?? []) as Record<string, unknown>[],
  );
}

export const listPendingTutorSessionCreationsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<PendingTutorSessionCreationDTO[]> => {
  const supabase = createSupabaseServerClient();
  await requireAdminContext(supabase);
  return loadPendingTutorSessionCreations(supabase);
});

export const approveTutorSessionCreationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => claimIdSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { userId } = await requireAdminContext(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        "id, status, source_scheduled_session_id, source_schedule_import_id, admin_creation_approved_at",
      )
      .eq("id", data.claimId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (!isTutorManualSessionClaim(row)) {
      throw new Error("Only tutor-created sessions use this approval flow.");
    }
    if (row.admin_creation_approved_at) {
      return { ok: true as const, alreadyApproved: true };
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("session_claims")
      .update({
        admin_creation_approved_at: now,
        admin_creation_approved_by: userId,
      })
      .eq("id", data.claimId);

    if (upErr) throw new Error(upErr.message);

    await appendClaimWorkflowEvent(supabase, {
      claimId: data.claimId,
      actorId: userId,
      actionType: CLAIM_WORKFLOW_ACTION.SESSION_CREATION_APPROVED,
      fromStatus: row.status as ClaimStatus,
      toStatus: row.status as ClaimStatus,
    });

    return { ok: true as const, alreadyApproved: false };
  });

export const rejectTutorSessionCreationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => claimIdSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    await requireAdminContext(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        "id, status, source_scheduled_session_id, source_schedule_import_id, admin_creation_approved_at",
      )
      .eq("id", data.claimId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (!isTutorManualSessionClaim(row)) {
      throw new Error("Only tutor-created sessions use this approval flow.");
    }
    if (row.admin_creation_approved_at) {
      throw new Error("This session was already approved and cannot be rejected here.");
    }
    if (row.status !== "DRAFT") {
      throw new Error("Only draft sessions can be rejected.");
    }

    const { error: delErr } = await supabase
      .from("session_claims")
      .delete()
      .eq("id", data.claimId);

    if (delErr) throw new Error(delErr.message);
    return { ok: true as const };
  });

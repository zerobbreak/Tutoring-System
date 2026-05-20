import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  approveTutorSessionRequest,
  previewTutorSessionRequestCapacity,
} from "#/lib/schedule-claims/approve-tutor-session-request";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";
import { isTutorManualSessionClaim } from "#/lib/tutor-manual-session-claim";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const claimIdSchema = z.object({
  claimId: z.string().uuid(),
});

const rejectSchema = z.object({
  claimId: z.string().uuid(),
  feedback: z.string().max(2000).optional(),
});

const suggestChangesSchema = z.object({
  claimId: z.string().uuid(),
  feedback: z.string().min(3).max(2000),
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
  session_kind: string | null;
  request_reason: string | null;
  request_status: string | null;
  review_feedback: string | null;
  tutor: { id: string; full_name: string; email: string } | null;
  module: { id: string; code: string; name: string } | null;
  capacity: {
    allocatedHours: number | null;
    reservedHours: number;
    requestedHours: number;
    availableHours: number | null;
    canApprove: boolean;
    warning: string | null;
  };
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
  session_kind,
  request_reason,
  request_status,
  review_feedback,
  tutor_id,
  module_id,
  source_scheduled_session_id,
  source_schedule_import_id,
  admin_creation_approved_at,
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email ),
  module:modules ( id, code, name )
`;

function mapPendingTutorSessionCreationRows(
  data: Record<string, unknown>[] | null,
  capacityById: Map<string, PendingTutorSessionCreationDTO["capacity"]>,
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
      const id = row.id as string;
      return {
        id,
        session_date: row.session_date as string,
        start_time: row.start_time as string,
        end_time: row.end_time as string,
        hours: Number(row.hours),
        venue: row.venue as string | null,
        status: row.status as string,
        updated_at: row.updated_at as string,
        session_kind: row.session_kind as string | null,
        request_reason: row.request_reason as string | null,
        request_status: row.request_status as string | null,
        review_feedback: row.review_feedback as string | null,
        tutor: tutor as PendingTutorSessionCreationDTO["tutor"],
        module: module as PendingTutorSessionCreationDTO["module"],
        capacity: capacityById.get(id) ?? {
          allocatedHours: null,
          reservedHours: 0,
          requestedHours: Number(row.hours),
          availableHours: null,
          canApprove: true,
          warning: null,
        },
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
    .in("request_status", [
      SESSION_REQUEST_STATUS.PENDING,
      SESSION_REQUEST_STATUS.CHANGES_REQUESTED,
    ])
    .is("source_scheduled_session_id", null)
    .is("source_schedule_import_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const capacityById = new Map<
    string,
    PendingTutorSessionCreationDTO["capacity"]
  >();

  for (const row of rows) {
    const id = row.id as string;
    capacityById.set(
      id,
      await previewTutorSessionRequestCapacity(supabase, {
        tutor_id: row.tutor_id as string,
        module_id: row.module_id as string,
        session_date: row.session_date as string,
        start_time: row.start_time as string,
        end_time: row.end_time as string,
        hours: row.hours as number | string,
      }),
    );
  }

  return mapPendingTutorSessionCreationRows(rows, capacityById);
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

    const { data: modRow, error: modErr } = await supabase
      .from("session_claims")
      .select("module:modules ( lecturer_id )")
      .eq("id", data.claimId)
      .maybeSingle();

    if (modErr) throw new Error(modErr.message);
    const modRaw = modRow?.module;
    const mod = Array.isArray(modRaw) ? modRaw[0] : modRaw;
    const lecturerId = (mod as { lecturer_id: string } | null)?.lecturer_id;

    return approveTutorSessionRequest(supabase, {
      claimId: data.claimId,
      reviewerId: userId,
      seriesCreatedBy: lecturerId ?? userId,
    });
  });

export const rejectTutorSessionCreationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rejectSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { userId } = await requireAdminContext(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        "id, status, source_scheduled_session_id, source_schedule_import_id, request_status",
      )
      .eq("id", data.claimId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (!isTutorManualSessionClaim(row)) {
      throw new Error("Only tutor-created sessions use this approval flow.");
    }
    if (row.request_status === SESSION_REQUEST_STATUS.APPROVED) {
      throw new Error(
        "This session was already approved and cannot be rejected here.",
      );
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("session_claims")
      .update({
        request_status: SESSION_REQUEST_STATUS.REJECTED,
        review_feedback: data.feedback?.trim() || null,
        reviewed_at: now,
        reviewed_by: userId,
      })
      .eq("id", data.claimId);

    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });

export const suggestChangesTutorSessionCreationFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => suggestChangesSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { userId } = await requireAdminContext(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        "id, tutor_id, source_scheduled_session_id, source_schedule_import_id, request_status",
      )
      .eq("id", data.claimId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (!isTutorManualSessionClaim(row)) {
      throw new Error("Only tutor-created sessions use this review flow.");
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("session_claims")
      .update({
        request_status: SESSION_REQUEST_STATUS.CHANGES_REQUESTED,
        review_feedback: data.feedback.trim(),
        reviewed_at: now,
        reviewed_by: userId,
      })
      .eq("id", data.claimId);

    if (upErr) throw new Error(upErr.message);

    await supabase.from("notifications").insert({
      recipient_id: row.tutor_id as string,
      claim_id: data.claimId,
      channel: "IN_APP",
      type: "SYSTEM",
      subject: "Session request — changes requested",
      body: data.feedback.trim(),
    });

    return { ok: true as const };
  });

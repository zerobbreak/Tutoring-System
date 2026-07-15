import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import {
  schedulingDateForColumn,
  type TimeKanbanColumnId,
} from "#/lib/session-kanban-column";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { isTutorSessionClaimVisible } from "#/lib/tutor-manual-session-claim";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

const timeColumnSchema = z.enum(["today", "upcoming", "completed"]);

const updateSchedulingSchema = z.object({
  claimId: z.string().uuid(),
  targetColumn: timeColumnSchema,
});

/** Reschedule claim into a time-based Kanban column (today / upcoming / completed). */
export const updateSessionClaimSchedulingFn = createServerFn({
  method: "POST",
})
  .validator((input: unknown) => updateSchedulingSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);
    const now = new Date();
    const session_date = schedulingDateForColumn(
      data.targetColumn as TimeKanbanColumnId,
      now,
    );

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        "id, source_scheduled_session_id, source_schedule_import_id, admin_creation_approved_at",
      )
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (!isTutorSessionClaimVisible(row)) {
      throw new Error(
        "This session is awaiting admin approval before you can reschedule it.",
      );
    }

    const { error: upErr } = await supabase
      .from("session_claims")
      .update({ session_date })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (upErr) throw new Error(upErr.message);
    return { ok: true as const, session_date };
  });

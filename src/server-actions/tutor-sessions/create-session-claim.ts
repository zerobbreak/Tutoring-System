import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { checkReservedCapacityForStandaloneClaim } from "#/server-actions/tutor-allocations/check-reserved-capacity";
import {
  parseSessionClockTimes,
  requireUserId,
} from "#/server-actions/tutor-sessions/helpers";

const createClaimSchema = z.object({
  moduleId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  venue: z.string().max(255).optional(),
  sessionKind: z.string().max(50).optional(),
  requestReason: z.string().min(10).max(2000),
});

/** Create a manual session claim (draft). */
export const createSessionClaimFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: assign, error: aErr } = await supabase
      .from("tutor_assignments")
      .select("id")
      .eq("tutor_id", tutorId)
      .eq("module_id", data.moduleId)
      .eq("is_active", true)
      .maybeSingle();

    if (aErr) throw new Error(aErr.message);
    if (!assign) {
      throw new Error(
        "You can only create sessions for modules you are assigned to.",
      );
    }

    const { start_time, end_time, hours } = parseSessionClockTimes(
      data.sessionDate,
      data.startTime,
      data.endTime,
    );

    const venue =
      data.venue?.trim() === "" ? null : (data.venue?.trim() ?? null);

    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("institution_id")
      .eq("id", data.moduleId)
      .maybeSingle();

    if (modErr) throw new Error(modErr.message);

    let budgetWarning: string | undefined;
    if (mod?.institution_id) {
      try {
        await checkReservedCapacityForStandaloneClaim(supabase, {
          tutorId,
          moduleId: data.moduleId,
          institutionId: mod.institution_id as string,
          hours,
          sessionDate: data.sessionDate,
          strict: true,
        });
      } catch (e) {
        budgetWarning =
          e instanceof Error ? e.message : "Hour allocation may be exceeded.";
      }
    }

    const sessionKind = data.sessionKind?.trim() || "tutorial";

    const row = {
      tutor_id: tutorId,
      module_id: data.moduleId,
      session_date: data.sessionDate,
      start_time,
      end_time,
      hours,
      venue,
      status: "DRAFT" as const,
      source_schedule_import_id: null as string | null,
      source_event_fingerprint: "",
      session_kind: sessionKind,
      request_reason: data.requestReason.trim(),
      request_status: SESSION_REQUEST_STATUS.PENDING,
      creation_source: "TUTOR_MANUAL" as const,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("session_claims")
      .insert(row)
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    return {
      claimId: inserted!.id as string,
      pendingApproval: true as const,
      budgetWarning,
    };
  });

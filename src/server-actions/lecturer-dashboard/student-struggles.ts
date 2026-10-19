import { createServerFn } from "@tanstack/react-start";
import { subDays, format } from "date-fns";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { normalizeSupabaseNestedRow } from "#/lib/supabase-nested-row";
import { createSupabaseServerClient } from "#/lib/supabase-server";

export const STUDENT_STRUGGLES_WINDOW_DAYS = 28;

export type LecturerStudentStruggleDTO = {
  claim_id: string;
  session_date: string;
  student_struggles: string | null;
  revision_topics: string | null;
  module: { id: string; code: string; name: string } | null;
  tutor_name: string | null;
  seen_at: string | null;
};

const listSchema = z.object({
  moduleId: z.string().uuid().optional(),
});

/**
 * Struggle / review notes tutors shared on submitted claims for the
 * lecturer's modules over the last four weeks, newest first.
 */
export const listLecturerStudentStrugglesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<LecturerStudentStruggleDTO[]> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const since = format(
      subDays(new Date(), STUDENT_STRUGGLES_WINDOW_DAYS),
      "yyyy-MM-dd",
    );

    let query = supabase
      .from("session_claims")
      .select(
        `
        id,
        session_date,
        student_struggles,
        revision_topics,
        module:modules!inner ( id, code, name, lecturer_id ),
        tutor:users!session_claims_tutor_id_fkey ( full_name )
      `,
      )
      .eq("module.lecturer_id", lecturerId)
      .neq("status", "DRAFT")
      .is("deleted_at", null)
      .gte("session_date", since)
      .or("student_struggles.not.is.null,revision_topics.not.is.null")
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(100);
    if (data.moduleId) query = query.eq("module_id", data.moduleId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id as string);
    const seenMap = new Map<string, string>();
    if (ids.length) {
      const { data: acks, error: ackErr } = await supabase
        .from("session_note_acknowledgements")
        .select("claim_id, seen_at")
        .in("claim_id", ids);
      if (ackErr) throw new Error(ackErr.message);
      for (const a of acks ?? []) {
        seenMap.set(a.claim_id as string, a.seen_at as string);
      }
    }

    return (rows ?? []).map((r) => {
      const mod = normalizeSupabaseNestedRow(
        r.module as
          | { id: string; code: string; name: string }
          | { id: string; code: string; name: string }[]
          | null,
      );
      const tutor = normalizeSupabaseNestedRow(
        r.tutor as { full_name: string } | { full_name: string }[] | null,
      );
      return {
        claim_id: r.id as string,
        session_date: r.session_date as string,
        student_struggles: r.student_struggles as string | null,
        revision_topics: r.revision_topics as string | null,
        module: mod ? { id: mod.id, code: mod.code, name: mod.name } : null,
        tutor_name: tutor?.full_name ?? null,
        seen_at: seenMap.get(r.id as string) ?? null,
      };
    });
  });

const markSeenSchema = z.object({ claimId: z.string().uuid() });

/** Lecturer acknowledges a session's shared notes; the tutor sees "Seen by lecturer". */
export const markStudentStrugglesSeenFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => markSeenSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    // RLS only allows the module's lecturer to insert; duplicates are a no-op.
    const { error } = await supabase
      .from("session_note_acknowledgements")
      .upsert(
        { claim_id: data.claimId, seen_by: lecturerId },
        { onConflict: "claim_id", ignoreDuplicates: true },
      );

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { createSupabaseServerClient } from "#/lib/supabase-server";

async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

export type TutorNotesClaimDTO = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  venue: string | null;
  status: ClaimStatus;
  notes: string | null;
  topics_covered: string | null;
  examples_used: string | null;
  student_struggles: string | null;
  revision_topics: string | null;
  coverage_validated_at: string | null;
  module: { code: string; name: string } | null;
};

type RawRow = Omit<TutorNotesClaimDTO, "module"> & {
  module: { code: string; name: string } | { code: string; name: string }[] | null;
};

function mapRow(r: RawRow): TutorNotesClaimDTO {
  const m = r.module;
  const module = m == null ? null : Array.isArray(m) ? (m[0] ?? null) : m;
  return { ...r, module };
}

export const listTutorNotesClaimsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TutorNotesClaimDTO[]> => {
    const supabase = createSupabaseServerClient();
    const uid = await requireUserId(supabase);

    const { data, error } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        session_date,
        start_time,
        end_time,
        hours,
        venue,
        status,
        notes,
        topics_covered,
        examples_used,
        student_struggles,
        revision_topics,
        coverage_validated_at,
        module:modules ( code, name )
      `,
      )
      .eq("tutor_id", uid)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as RawRow[]).map(mapRow);
  },
);

const updateNotesSchema = z.object({
  claimId: z.string().uuid(),
  topicsCovered: z.string(),
  examplesUsed: z.string(),
  studentStruggles: z.string(),
  revisionTopics: z.string(),
  notes: z.string(),
  coverageConfirmed: z.boolean(),
  existingCoverageValidatedAt: z.string().nullable(),
});

export const updateSessionNotesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateNotesSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const uid = await requireUserId(supabase);

    let nextValidatedAt: string | null = data.existingCoverageValidatedAt;
    if (data.coverageConfirmed && !data.existingCoverageValidatedAt) {
      nextValidatedAt = new Date().toISOString();
    }
    if (!data.coverageConfirmed) {
      nextValidatedAt = null;
    }

    const trim = (s: string) => (s.trim() === "" ? null : s.trim());

    const { data: updated, error } = await supabase
      .from("session_claims")
      .update({
        topics_covered: trim(data.topicsCovered),
        examples_used: trim(data.examplesUsed),
        student_struggles: trim(data.studentStruggles),
        revision_topics: trim(data.revisionTopics),
        notes: trim(data.notes),
        coverage_validated_at: nextValidatedAt,
      })
      .eq("id", data.claimId)
      .eq("tutor_id", uid)
      .select(
        `
        id,
        session_date,
        start_time,
        end_time,
        hours,
        venue,
        status,
        notes,
        topics_covered,
        examples_used,
        student_struggles,
        revision_topics,
        coverage_validated_at,
        module:modules ( code, name )
      `,
      )
      .single();

    if (error) throw new Error(error.message);
    return mapRow(updated as RawRow);
  });

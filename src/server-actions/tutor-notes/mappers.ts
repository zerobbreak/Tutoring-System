import { normalizeSupabaseNestedRow } from "#/lib/supabase-nested-row";
import type { TutorNotesClaimDTO } from "#/server-actions/tutor-notes/types";

type ModuleRow = { id: string; code: string; name: string };

export const NOTES_CLAIM_SELECT = `
  id,
  module_id,
  session_date,
  start_time,
  end_time,
  status,
  topics_covered,
  student_struggles,
  revision_topics,
  examples_used,
  notes,
  source_scheduled_session_id,
  source_schedule_import_id,
  admin_creation_approved_at,
  request_status,
  module:modules ( id, code, name )
`;

export type RawNotesClaimRow = Omit<
  TutorNotesClaimDTO,
  "module" | "private_note" | "seen_by_lecturer_at"
> & {
  module_id: string;
  source_scheduled_session_id: string | null;
  source_schedule_import_id: string | null;
  admin_creation_approved_at: string | null;
  request_status: string | null;
  module: ModuleRow | ModuleRow[] | null;
};

export function mapNotesClaimRow(
  r: RawNotesClaimRow,
  extras: { privateNote: string | null; seenAt: string | null },
): TutorNotesClaimDTO {
  return {
    id: r.id,
    session_date: r.session_date,
    start_time: r.start_time,
    end_time: r.end_time,
    status: r.status,
    topics_covered: r.topics_covered,
    student_struggles: r.student_struggles,
    revision_topics: r.revision_topics,
    examples_used: r.examples_used,
    notes: r.notes,
    private_note: extras.privateNote,
    seen_by_lecturer_at: extras.seenAt,
    module: normalizeSupabaseNestedRow(r.module),
  };
}

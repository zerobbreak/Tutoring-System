export type ClaimCreationSource =
  | "SCHEDULE"
  | "TUTOR_MANUAL"
  | "IMPORT"
  | "LECTURER_ONE_OFF";

export function inferCreationSource(row: {
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
  session_kind?: string | null;
}): ClaimCreationSource {
  if (row.source_scheduled_session_id) {
    if (row.session_kind === "one_off") return "LECTURER_ONE_OFF";
    return "SCHEDULE";
  }
  if (row.source_schedule_import_id) return "IMPORT";
  return "TUTOR_MANUAL";
}

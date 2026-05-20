/** Short label for how a session claim was created (UI badges). */
export function claimSourceLabel(claim: {
  creation_source?: string | null;
  scheduled_session_id?: string | null;
  session_kind?: string | null;
}): string | null {
  const src = claim.creation_source;
  if (src === "SCHEDULE" || claim.scheduled_session_id) return "Official";
  if (src === "LECTURER_ONE_OFF" || claim.session_kind === "one_off") {
    return "One-off";
  }
  if (src === "IMPORT") return "Import";
  if (src === "TUTOR_MANUAL" || claim.session_kind === "manual" || claim.session_kind === "ad_hoc") {
    return "Ad-hoc";
  }
  return null;
}

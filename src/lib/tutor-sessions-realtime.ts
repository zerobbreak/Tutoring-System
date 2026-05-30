import { supabase } from "#/lib/supabase";

/** Subscribe to claim changes for the signed-in tutor (debounced reload in caller). */
export function subscribeToTutorSessionClaims(
  tutorId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`tutor-session-claims:${tutorId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "session_claims",
        filter: `tutor_id=eq.${tutorId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

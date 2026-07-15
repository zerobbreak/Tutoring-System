import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";

type Db = SupabaseClient;

export async function loadUnlockSessionContext(
  db: Db,
  scheduledSessionId: string,
  institutionId: string,
): Promise<{
  tutorId: string;
  moduleCode: string;
  moduleName: string;
  venueName: string;
  startsAt: string;
  claimId: string | null;
}> {
  const { data: session, error } = await db
    .from("scheduled_sessions")
    .select(
      `
      id,
      starts_at,
      tutor_id,
      venue_text,
      module:modules!scheduled_sessions_module_id_fkey ( code, name, institution_id ),
      venue:venues ( name ),
      series:schedule_series!scheduled_sessions_series_id_fkey ( title )
    `,
    )
    .eq("id", scheduledSessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session) throw new Error("Session not found.");

  const mod = session.module as unknown as {
    code: string;
    name: string;
    institution_id: string;
  } | null;
  if (!mod || mod.institution_id !== institutionId) {
    throw new Error("Session not found or access denied.");
  }

  const venue = session.venue as unknown as { name: string } | null;
  const venueName =
    venue?.name ?? (session.venue_text as string | null)?.trim() ?? "the room";

  const { data: claim } = await db
    .from("session_claims")
    .select("id")
    .eq("source_scheduled_session_id", scheduledSessionId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    tutorId: session.tutor_id as string,
    moduleCode: mod.code,
    moduleName: mod.name,
    venueName,
    startsAt: session.starts_at as string,
    claimId: (claim?.id as string | null) ?? null,
  };
}

export async function notifyUnlockResponders(
  db: Db,
  input: {
    institutionId: string;
    type: string;
    subject: string;
    body: string;
    excludeUserId?: string;
  },
): Promise<number> {
  const { data: responders, error } = await db
    .from("users")
    .select("id")
    .eq("institution_id", input.institutionId)
    .eq("can_unlock_venues", true)
    .eq("user_status", "ACTIVE");

  if (error) throw new Error(error.message);

  const rows = (responders ?? [])
    .map((r) => r.id as string)
    .filter((id) => id !== input.excludeUserId)
    .map((recipient_id) => ({
      recipient_id,
      claim_id: null,
      channel: "IN_APP" as const,
      type: input.type,
      subject: input.subject,
      body: input.body,
    }));

  if (!rows.length) return 0;

  const { error: insErr } = await db.from("notifications").insert(rows);
  if (insErr) throw new Error(insErr.message);
  return rows.length;
}

export function formatUnlockSessionLabel(input: {
  moduleCode: string;
  venueName: string;
  startsAt: string;
}): string {
  const start = parseISO(input.startsAt);
  return `${input.moduleCode} tutor needs ${input.venueName} open at ${format(start, "HH:mm")}`;
}

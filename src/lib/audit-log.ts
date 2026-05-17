import { getSupabaseAdmin } from "#/lib/supabase-admin";
import type { createSupabaseServerClient } from "#/lib/supabase-server";

export type InstitutionAuditEvent = {
  institutionId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  event: string;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Insert an institution audit row (uses service role when available). */
export async function logInstitutionAudit(
  _supabase: ReturnType<typeof createSupabaseServerClient>,
  entry: InstitutionAuditEvent,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const db = admin ?? _supabase;

  const { error } = await db.from("audit_logs").insert({
    institution_id: entry.institutionId,
    actor_id: entry.actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    event: entry.event,
    payload: entry.payload ?? {},
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  });

  if (error) {
    console.error("audit_logs insert failed:", error.message);
  }
}

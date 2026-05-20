import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertModuleInInstitution } from "#/server-actions/admin-schedules/helpers";
import {
  fetchManagedSession,
  restoreScheduledSessionRecord,
} from "./session-lifecycle";
import { restoreSessionSchema } from "./schemas";

export const adminRestoreScheduledSessionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => restoreSessionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);
    const session = await fetchManagedSession(supabase, data.sessionId);
    await assertModuleInInstitution(supabase, session.module_id, institutionId);
    await restoreScheduledSessionRecord(supabase, {
      sessionId: data.sessionId,
      actorId: userId,
      institutionId,
    });
    return { ok: true };
  });

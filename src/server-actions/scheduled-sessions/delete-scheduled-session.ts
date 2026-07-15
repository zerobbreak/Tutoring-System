import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext, resolveAdminWriteClient } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertModuleInInstitution } from "#/server-actions/admin-schedules/helpers";
import {
  deleteScheduledSessionRecord,
  fetchManagedSession,
} from "./session-lifecycle";
import { sessionActionSchema } from "./schemas";

export const adminDeleteScheduledSessionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => sessionActionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);
    const session = await fetchManagedSession(supabase, data.sessionId);
    await assertModuleInInstitution(supabase, session.module_id, institutionId);
    const writeDb = resolveAdminWriteClient(supabase);
    await deleteScheduledSessionRecord(writeDb, {
      sessionId: data.sessionId,
      actorId: userId,
      reason: data.reason,
      institutionId,
    });
    return { ok: true };
  });
